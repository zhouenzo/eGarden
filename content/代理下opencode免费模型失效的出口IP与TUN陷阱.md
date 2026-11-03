---
title: 代理下 opencode 免费模型失效：按出口 IP 判定的网关与 TUN 陷阱
date: 2026-11-03
draft: true
slug: ""
tags:
  - opencode
  - clash
  - proxy
  - tun
  - network
categories:
  - 网络
  - 配置
description: "开代理后 opencode 免费模型报 Free usage limit reached 或 not available in your country。实测证明免费网关按出口 IP 判定，TUN 才接管进程流量；给出 Clash Verge 规则直连的修复与验证方法"
aliases: []
featured_image: ""
lang: zh-cn
weight: 0
author: enzo
---

打开代理，本来是为了让 AI 编程工具更好用。结果反过来了：opencode 的免费模型全军覆没，关掉代理立刻恢复。

现象很迷惑——同一个客户端、同一个模型，昨天还能用，今天挂了；切换节点没用，换个模式又好像有点用。本文把这次排障的实测数据、根因和修复步骤完整写下来，重点是两个容易被忽略的认知点：

1. **免费模型网关是按请求的出口 IP 判定的**，不是"检测到你在用 VPN"；
2. **系统代理对 Bun/Node 程序无效，TUN 才是真正接管进程流量的那一层**。

## 结论先行

- 免费模型有两种拦截，报错文案不同：`This model is not available in your country` 是地区限制；`Free usage limit reached` 是当前出口 IP 不被免费额度接受。
- 只开系统代理时 opencode 其实在直连（它不读桌面环境的代理设置），所以免费模型正常；一开 TUN，流量从路由层被劫走，出口变成机房 IP，于是被拒。
- 修复不是"换个更好的节点"，而是**让 opencode 相关域名直连**：Clash Verge 切到规则模式，用 `prepend` 加两条 `DIRECT` 规则，重新应用配置后再开 TUN。

## 一次只改一个变量的对照实验

排障最怕变量太多。这次把条件固定在：同一台机器、同一个 opencode v2.1.4、同两个模型，**唯一变量是出口 IP**。

| 出口 | `opencode/big-pickle` | `opencode/beam-free` |
| --- | --- | --- |
| 直连（中国大陆家宽） | 正常返回 OK | 报 `This model is not available in your country` |
| 走代理（东京机房） | 报 `Free usage limit reached` | 报 `Free usage limit reached` |

两份报错的原文（完整版，未删减）：

```text
Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models.
```

```text
This model is not available in your country
```

这张表的信息量比看起来大：

- 直连时 `big-pickle` 能用，说明账号、客户端、网络连通性都没问题；
- 换成机房出口后，连原本能用的 `big-pickle` 也挂，说明**不是模型本身的问题，是出口的问题**；
- `beam-free` 在直连时给出的是另一句报错（地区限制），在机房出口时变成额度报错，说明这是**两套独立的拦截逻辑**，不要混为一谈。

## 根因第一层：网关按出口 IP 判定，而且有两种拦截

先澄清一个常见误解：opencode 没有在本地"检测 VPN"然后拒绝你。判定发生在服务端，依据是这次 HTTP 请求的**出口 IP**。同一个客户端换个出口，结论立刻不同——上面的表格就是证据。

### 拦截一：国家/地区限制

部分免费模型在官方文档里就写明了排除地区。以下名单摘自 opencode 文档 Console/Models 页的「Free models」一节：

- **Beam Free**：排除安哥拉、白俄罗斯、柬埔寨、中国（含香港澳门）、古巴、刚果民主共和国、赤道几内亚、伊朗、伊拉克、老挝、利比亚、尼日利亚、朝鲜、俄罗斯、叙利亚、土库曼斯坦、乌兹别克斯坦、委内瑞拉，以及乌克兰的克里米亚、顿涅茨克、卢甘斯克地区。
- **Pulse Alpha Free**：排除欧盟、冰岛、列支敦士登、挪威、古巴、伊朗、朝鲜、俄罗斯、乌克兰、委内瑞拉。

这解释了直连时 `beam-free` 的那句报错：人在中国大陆，出口也在中国大陆，模型直接不可用。这条限制跟代理没关系，是模型本身的可用范围。

### 拦截二：IP 被判为不能使用免费额度

另一种拦截不看你属于哪个国家，而是看这个 IP "像不像一个正常用户"：机房 IP、被大量共享的代理出口，会被直接回 `Free usage limit reached`。

这里的文案有很强的误导性——它写着"额度用完了"，但实际情况是额度**按出口 IP 计算**。你换一个出口 IP，额度就是另一份，结果可能立刻不同。反过来说，一个被上千人共用的机房 IP，哪怕你一次都没用过，也可能一直"额度已满"。

> [!note] 事实与推断分开说
> 事实：同一账号、同一模型，仅更换出口 IP，报错从"正常"变成 `Free usage limit reached`，且该机房 IP 从未被这个账号使用过。
> 推断：免费额度以出口 IP 为维度做限流，并对机房/共享 IP 段有额外判定。opencode 文档未公开这部分的实现细节，因此"具体用了哪些 IP 库、阈值是多少"属于未验证。

顺带说明为什么"换个节点"在这台机器上走不通：当时只有一条订阅节点，出口固定在东京机房，没有可切换的干净出口。即便有，机房 IP 大概率仍落在"不可用于免费额度"的判定里，换来换去只是换一台机器被拒。

## 根因第二层：TUN 接管一切，系统代理什么也没接管

这是全文最值得记住的一点，也是"只开系统代理没事、开了 TUN 就废"的原因。

opencode 是 Bun/Node 程序。这类运行时不读 GNOME/KDE 的桌面系统代理设置，它们只认环境变量：`HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`。所以：

- **只开系统代理**：桌面环境里那些图形程序会走代理，但 opencode 进程看不到这个设置，实际是**直连**。免费模型正常，因为它走的是中国大陆家宽出口。
- **开 TUN**：TUN 在操作系统路由层接管流量，进程完全无感——不管有没有设置环境变量，包都会进节点。于是 opencode 的请求从东京机房出去，撞上"机房 IP 不给免费额度"。

> [!warning] 结论
> TUN 开着的时候，系统代理是多余的。二选一即可，两个都开会让你更难判断流量到底从哪出去。

理解了这层，很多"玄学"就消失了：改系统代理设置对 opencode 无效、改环境变量对 TUN 无效、关掉 TUN 后一切都好——都不是巧合。

## 修复：让 opencode 域名直连

既然问题出在出口 IP，最省事的解法是：**opencode 相关域名走直连，其余流量照常走代理**。实测国内直连这几个域名是通的，可用性没问题。

### 前置条件：必须从「全局」切到「规则」

全局模式会无视所有规则，把流量全部丢给 GLOBAL 选择器。在全局模式下加任何规则都不会生效——先切模式，再谈规则。

### 加规则

规则加在 Clash Verge 的「配置增强 → 规则」覆盖文件里。GUI 路径是：订阅 → 右键当前配置 → 编辑规则。磁盘上对应：

```text
~/.local/share/io.github.clash-verge-rev.clash-verge-rev/profiles/<uid>.yaml
```

内容用 `prepend`，保证排在最前，且订阅更新不会覆盖：

```yaml
prepend:
  - DOMAIN-SUFFIX,opencode.ai,DIRECT
  - DOMAIN-SUFFIX,models.dev,DIRECT

append: []
delete: []
```

`DOMAIN-SUFFIX,opencode.ai` 一条就能覆盖 `opencode.ai` 本身和 `opencode.ai/inference/...`、`models.opencode.ai` 这些子域。`models.dev` 是模型目录，一并直连可以减少启动时的等待。

### 顺序：先应用配置，再开 TUN

改完必须**重新应用配置**（订阅页点回当前配置，或重启 Clash Verge），让规则真正生成进运行时的 `clash-verge.yaml`。

> [!warning] 顺序错了会以为修复没生效
> 正确的顺序是：切规则模式 → 加规则 → 重新应用配置 → 开 TUN。
> 如果先开 TUN 再改配置，内核里跑的还是旧规则，一开 TUN 又会踩回原坑，看起来像是"规则没用"。

## 验证：三条命令确认到底有没有生效

mihomo 暴露了 unix socket API，比在 GUI 里猜状态可靠得多。

**看当前模式和 TUN 状态**：

```bash
curl -s --unix-socket /tmp/verge/verge-mihomo.sock http://localhost/configs \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('mode =',d['mode']);print('tun  =',d['tun']['enable'])"
```

期望输出 `mode = rule`，TUN 状态与你的预期一致。

**确认规则真的排在最前**：

```bash
curl -s --unix-socket /tmp/verge/verge-mihomo.sock http://localhost/rules \
  | grep -iE 'opencode|models\.dev'
```

应能看到 `opencode.ai` 与 `models.dev` 指向 `DIRECT`。

**隔离测试模型**：

```bash
opencode run --standalone --model opencode/big-pickle "reply with exactly: OK"
```

`--standalone` 不能省。不加它，命令会复用后台服务，而环境变量、代理设置都是后台服务继承的那一份，测出来的结果可能和你当前 shell 的环境对不上。

**直连可用性实测**：`https://opencode.ai/inference/v1/models`、`https://models.opencode.ai`、`https://models.dev/api.json` 在中国大陆家宽直连均返回 200，耗时分别约 2.5 秒、6.6 秒、5.3 秒。也就是说走直连不需要额外条件，慢一点但能用。

## 反向场景：如果你就是要让 opencode 走代理

有时候直连确实不行，或者你希望统一走代理。这时候要注意两件事。

**一、出口要落在允许的国家，且 IP 要"干净"**。美国、日本、新加坡通常没问题；但被大量共享的机房 IP 依然会回 `Free usage limit reached`，这一点换国家解决不了。

**二、CLI 和后台服务是两个进程**。在 shell 里 `export HTTPS_PROXY=...` 不会传给已经运行的后台服务，必须持久化到服务配置：

```bash
opencode service set env HTTPS_PROXY http://127.0.0.1:7897
opencode service set env NO_PROXY localhost,127.0.0.1,::1
```

`NO_PROXY` 那条必须有，否则 CLI 连不上本地服务，表现是另一个看起来完全不相关的故障。

> [!warning] 这条反过来也是个坑
> 如果你曾经随手给服务设过 `HTTPS_PROXY`，那么**即使 TUN 关着**，opencode 的请求也会被塞进代理，免费模型照样失效。排查"关掉代理还是不行"时，先查这里。

## 容易重复踩的坑

| 坑 | 表现 | 正确处理 |
| --- | --- | --- |
| 全局模式下加规则 | 规则列表里有，但完全不生效 | 先切规则模式 |
| 改完不重新应用配置 | 文件改了，运行时还是旧规则 | 订阅页点回当前配置，或重启 |
| 先开 TUN 再应用配置 | 一开 TUN 就复发 | 先应用配置，再开 TUN |
| TUN 与系统代理同时开 | 分不清流量从哪出去 | 二选一 |
| 用 shell 里的 `export` 给服务设代理 | 设了等于没设 | `opencode service set env` |
| 测模型不隔离 | 结果受后台服务旧环境影响 | `opencode run --standalone` |

## 判断清单

下次再遇到"开了代理，AI 编程工具的免费额度突然没了"，按这个顺序走：

1. **先看报错是哪一句。** 文案不同，原因不同，别把两件事混成一件。
2. **`This model is not available in your country`** → 国家/地区限制。换到允许地区的出口，或者干脆让该域名直连。注意这是模型自身的可用范围，跟代理配置无关。
3. **`Free usage limit reached`** → 出口 IP 不被免费额度接受。两条路：换一个干净的非机房出口，或让 `opencode.ai` / `models.dev` 直连。
4. **确认到底是哪一层在接管流量。** 只开系统代理时 opencode 是直连的；只有 TUN 才会把进程流量强制带走。看 `configs` 里的 `mode` 和 `tun.enable`，不要靠猜。
5. **改完规则记得重新应用配置**，顺序是先配置后 TUN，然后用 `/rules` 接口确认规则真的在最前面。

核心就一句：**这类"免费额度"是按出口 IP 发的，不是按账号发的。** 搞清楚流量从哪个 IP 出去，问题就解决了一半。

## 参考

- opencode 文档 Console/Models 页「Free models」一节（各免费模型的地区限制与免费说明）：[https://opencode.ai/docs/zen/](https://opencode.ai/docs/zen/)
- opencode 模型列表接口：`https://opencode.ai/inference/v1/models`（本文用于验证直连可用性）
- 模型目录：[https://models.dev](https://models.dev)
