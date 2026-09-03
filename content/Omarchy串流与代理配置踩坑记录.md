---
title: Omarchy 串流与代理配置踩坑记录
date: 2026-08-30
draft: false
slug: ""
tags:
  - omarchy
  - sunshine
  - moonlight
  - clash
  - fcitx5
categories: []
description: "在 Omarchy (Arch + Hyprland) 上配置 Sunshine 串流、Clash 代理、中文输入法的完整踩坑记录"
aliases: []
featured_image: ""
lang: zh-cn
weight: 0
author: enzo
---

最近在 Dell 笔记本上搭建了 Omarchy（Arch + Hyprland）环境，用于 Moonlight 远程串流和日常使用。过程中遇到了不少问题，记录下来供参考。

# fcitx5 中文输入法配置

## 问题

在 Omarchy 上安装 fcitx5 后，发现中文输入完全无法使用——无法切换输入法、浏览器中打不出中文。

## 原因

两个关键问题叠加：

1. **缺少中文引擎**：只装了 fcitx5 框架，没有安装 `fcitx5-chinese-addons`（Pinyin 引擎）
2. **Wayland IME 兼容**：Omarchy 默认的 Chromium 启动时没有加 `--enable-wayland-ime`，导致浏览器连不上 fcitx5

## 解决方案

**1. 安装中文引擎**

```bash
sudo pacman -S fcitx5-chinese-addons
```

> [!warning] 可能遇到 SSL EOF
> 镜像源偶发网络中断会导致下载失败，清理缓存重试即可：
> ```bash
> sudo rm -f /var/cache/pacman/pkg/libime-*.pkg.tar.zst
> sudo pacman -S --noconfirm fcitx5-chinese-addons
> ```

**2. 配置环境变量**

在 `~/.config/hypr/input.lua` 中设置 IME 相关环境变量：

```lua
env = {
    "GTK_IM_MODULE,fcitx",
    "QT_IM_MODULE,fcitx",
    "SDL_IM_MODULE,fcitx",
    "GLFW_IM_MODULE,ibus",
    "XMODIFIERS,@im=fcitx",
}
```

**3. Chromium 启用 Wayland IME**

创建 `~/.config/chromium-flags.conf`，加入：

```
--enable-wayland-ime
```

**4. 绑定切换快捷键**

在 `~/.config/hypr/bindings.lua` 中绑定 `Ctrl+Space` 切换 keyboard-us ↔ Pinyin。可用 `~/.local/bin/fcitx5-toggle` 脚本实现。

> [!note] 验证技巧
> 终端和 opencode TUI 等应用不具备 IME 能力，不要用它们测试中文输入。打开 Chromium 或其他 GUI 应用测试。

# Sunshine 串流完整配置

Sunshine 是 Moonlight 的开源服务端。在 Omarchy 上配置串流经历了四个阶段的问题。

## 1. 安装 Sunshine

Omarchy 仓库内置 Sunshine，直接安装：

```bash
sudo pacman -S sunshine
systemctl --user enable --now sunshine
```

Web UI 地址：`https://localhost:47990`

> [!note] GPU 编码器
> 混显环境（如 GTX 960M + Intel HD 530）可能出现黑屏，需在 Sunshine 设置中把编码器固定为 `nvenc`。

## 2. 防火墙放行端口

Moonlight 无法连接 Sunshine，排查发现 UFW 默认策略是 DROP，没有放行 Sunshine 端口。

```bash
sudo ufw allow 47984,47989,47990,48010/tcp
sudo ufw allow 47998,47999,48000,48001,48010/udp
```

> [!note] 排查顺序
> 网络问题分层排查：应用进程健康 → 端口监听 → 路由 → 防火墙 → 客户端侧。这次问题只在防火墙这一层。

## 3. 合盖不休眠

Dell 笔记本合盖后 Sunshine 断连，原因是 systemd-logind 默认合盖行为是 `suspend`。

创建 override 文件 `/etc/systemd/logind.conf.d/30-headless-lid.conf`：

```ini
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
```

**需要重启生效**——logind 只在启动时读取配置。重启后合盖时 Omarchy 会锁屏但不会休眠，Sunshine 持续工作。

## 4. 空闲断连（idle 问题）

Moonlight 一段时间不操作后出现 `-1` 报错，视频流中断。

**原因**：Moonlight 远程操作时本地没有键鼠输入，Omarchy idle 机制判定系统"空闲"。到点后屏保启动 + 锁屏关显示器，中断了 Sunshine 的 screencopy 抓屏会话。

**解决方案**：使用 Omarchy 的 stay-awake 机制：

```bash
omarchy toggle idle stay-awake
```

> [!warning] 不要把 idle timeout 改成 0
> 把 `shell.json` 的 `screensaver`/`lock` 改成 0 会导致 `firstIdleTimeoutSeconds = min(0,0) = 0`，IdleMonitor 以 0 超时立即触发屏保/锁屏，反而更糟。

验证状态：

```bash
omarchy-shell idle status
# 应显示 stayAwake: true, enabled: false
```

恢复自动锁屏：`omarchy toggle idle allow-idle`

# Clash Verge Rev 代理配置

## 安装

原版 Clash Verge 已停止维护，使用继任项目 **Clash Verge Rev**。

```bash
yay -S clash-verge-rev-bin
```

> [!note] GitHub 不可达的绕行
> `github.com` 被墙，但 GitHub 的 asset CDN 可达。可通过镜像下载 `.deb`，再用 AUR PKGBUILD 本地构建。

## TUN 模式与 IPv6 冲突

打开 TUN 模式后，所有程序（含 Chromium）都被内核层劫持走代理。但默认配置 `ipv6: true` 与 IPv4-only VPN 冲突，导致部分网站连不上。

**解决**：在 Clash Verge 的 Merge 覆写（`Merge.yaml`）中加入：

```yaml
ipv6: false
```

重启应用后重新生成配置即生效。

## TUN 劫持局域网

开启 TUN 模式后，同局域网的 Mac 上的 Moonlight 找不到这台机器——因为 TUN 模式在内核层劫持了**所有流量**，包括局域网段。

**解决**：在订阅 Merge 覆写配置中加入 `route-exclude-address`：

```yaml
route-exclude-address:
  - 192.168.0.0/16
  - 10.0.0.0/8
  - 172.16.0.0/12
  - 224.0.0.0/4
```

验证：

```bash
ip route get 192.168.3.13   # LAN 应走 main 表直连而非 Meta
```

> [!warning] 配置重载陷阱
> 在 GUI 点"重新加载"可能只是从轻量模式恢复，没有真正重新生成配置。需确认 mihomo 进程实际重载了新配置。

# opencode + Obsidian 自动记录机制

最后一个小工具：搭建了 opencode 会话结束时自动询问是否将问题记录到 Obsidian 的机制。

## 实现方式

1. **全局 skill**：`~/.config/opencode/skills/errorbook/SKILL.md`，定义记录模板和写入流程
2. **全局指令**：`~/.config/opencode/instructions.md`，提醒 agent 在会话结束时主动询问
3. **目标 vault**：`~/Documents/Notes/ErrorBook/Problems/<topic>.md`

每条记录包含：背景、原因、解决方案、备注。先与用户确认再写入，不自动乱记。

---

以上就是在 Omarchy 上从零搭建串流 + 代理环境的主要踩坑经历。核心教训：**网络问题分层排查**、**合盖休眠查 logind**、**idle 配置别乱改 timeout**、**TUN 模式注意局域网路由**。
