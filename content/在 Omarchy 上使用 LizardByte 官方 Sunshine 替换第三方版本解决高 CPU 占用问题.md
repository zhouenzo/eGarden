---
title: 在 Omarchy 上使用 LizardByte 官方 Sunshine 替换第三方版本解决高 CPU 占用问题
date: 2026-10-25
draft: false
slug: ""
tags: ["Omarchy", "Sunshine", "Moonlight", "NVENC", "CUDA", "Linux", "串流"]
categories: ["Linux", "配置"]
description: "通过使用 LizardByte 官方预编译 AppImage 替换 omarchy/archlinuxcn 的第三方 Sunshine 包，解决 Moonlight 串流时 CPU 占用过高、温度飙升的问题，实现在 NVIDIA 显卡上使用 NVENC 硬编码。"
aliases: []
featured_image: ""
lang: zh-cn
weight: 0
author: enzo
---

## 1. 背景

在 Omarchy（基于 Arch Linux）的环境下，直接使用 `omarchy/sunshine` 或 `archlinuxcn/sunshine` 这类第三方仓库提供的 `sunshine` 包进行 Moonlight 串流时，会出现以下问题：

- 串流时 CPU 占用过高，导致机体温度大幅飙升
- 实际并未使用 NVIDIA 的 NVENC 硬编码，而是回退到了 VAAPI 或 CPU 软编码
- 即使日志中看似有 CUDA 相关符号，实际构建也并未真正启用 CUDA/NVENC 支持

究其原因是，这些第三方仓库的构建大多没有开启 LizardByte 官方所推荐的 CUDA/NVENC 编码路径。

## 2. 解决思路

最简单且最适合 Omarchy 的解决方案就是直接使用 [LizardByte/Sunshine](https://github.com/LizardByte/Sunshine/releases) 官方提供的预编译版本。

官方的 Linux AppImage 已经内置了 NVENC 所需的支持，配合 `systemd` 用户服务以及正确的 NVIDIA 环境变量即可在 Omarchy 上正常运行，并实现在串流时使用 GPU 硬编码，从而大幅降低 CPU 占用和发热。

> 注：LizardByte 官方也支持从源码编译，但对于日常使用来说，直接使用官方 AppImage 是最省心的方式。

## 3. 详细安装与自启动步骤

### 3.1 备份配置（可选但推荐）

Sunshine 的配置文件都存放在 `~/.config/sunshine/` 中，换用官方版本并不会覆盖这些配置。为了保险起见，可以先备份一份。

```bash
cp -r ~/.config/sunshine ~/.config/sunshine.bak.$(date +%Y%m%d)
```

### 3.2 下载 LizardByte 官方 AppImage

Omarchy 推荐使用特定版本的官方构建。以当前实践为例，推荐下载以下版本：

前往 [LizardByte Sunshine Releases](https://github.com/LizardByte/Sunshine/releases/tag/v2026.1018.5342)

在 `Assets` 中找到以下文件并下载至本地：

```text
sunshine-v2026.1018.5342-x86_64.AppImage
```

下载完成后，放到统一的目录方便管理。这里推荐放在 `~/Applications/`。

```bash
mkdir -p ~/Applications
cd ~/Applications
# 将下载的文件重命名为 sunshine.AppImage
mv sunshine-v2026.1018.5342-x86_64.AppImage sunshine.AppImage
# 添加执行权限
chmod +x sunshine.AppImage
```

### 3.3 安装 FUSE2 依赖

大部分 LizardByte 官方 AppImage 都依赖 `libfuse.so.2` 才能正常挂载运行。在 Arch/Omarchy 上需要安装 `fuse2`。

```bash
sudo pacman -S --needed fuse2
```

### 3.4 测试 AppImage 是否正常运行

先测试一下能否直接启动并查看版本信息。

```bash
~/Applications/sunshine.AppImage --version
```

正常情况下会输出类似以下内容：

```text
[...]
Info: Sunshine version: 2026.1018.5342 commit: 3d6e1d6008bd4a24906283ab25fcd0becc0a1c07
Info: Package Publisher: LizardByte
```

同时验证一下是否为带 CUDA 支持的构建（理论上该版本已内置支持）：

```bash
strings ~/Applications/sunshine.AppImage | grep -i "This build does not include CUDA"
```

如果**没有任何输出**，则代表此构建已包含 CUDA/NVENC 支持。

### 3.5 卸载 Omarchy/第三方仓库的 Sunshine（避免冲突）

由于先前已安装的 `omarchy/sunshine` 或 `archlinuxcn/sunshine` 仍会占用端口、进程以及可能与配置产生冲突，建议将其卸载。

```bash
# 停止所有可能存在的 sunshine 服务
systemctl --user disable --now sunshine 2>/dev/null
systemctl --user disable --now sunshine-appimage 2>/dev/null
systemctl --user disable --now sunshine-official 2>/dev/null
systemctl --user disable --now sunshine-extracted 2>/dev/null
systemctl --user disable --now sunshine-official-extracted 2>/dev/null
sudo systemctl disable --now sunshine 2>/dev/null

# 杀掉残留进程
pkill -x sunshine 2>/dev/null
sleep 2

# 卸载系统包
sudo pacman -Rns sunshine
```

> 注意：`pacman -Rns` 会弹出密码确认，直接输入密码即可。

### 3.6 配置 systemd 用户服务实现自启动

在 Omarchy 上最推荐使用 `systemd --user` 来管理 Sunshine，这样不用 root 权限也能随用户会话自启。

#### 创建服务文件

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/sunshine-official.service << 'EOF'
[Unit]
Description=Sunshine (LizardByte official AppImage)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=%h/Applications/sunshine.AppImage
Restart=on-failure
RestartSec=5
Environment=XDG_RUNTIME_DIR=%t
# NVIDIA / Vulkan 强制环境变量（针对混合显卡环境尤其关键）
Environment=VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
Environment=__NV_PRIME_RENDER_OFFLOAD=1
Environment=__GLX_VENDOR_LIBRARY_NAME=nvidia
Environment=__VK_LAYER_NV_optimus=NVIDIA_only
Environment=NVIDIA_DRIVER_CAPABILITIES=all
Environment=CUDA_VISIBLE_DEVICES=0

[Install]
WantedBy=default.target
EOF
```

#### 启用并启动服务

```bash
systemctl --user daemon-reload
systemctl --user enable --now sunshine-official.service
```

#### 检查服务状态

```bash
systemctl --user status sunshine-official.service --no-pager
```

如果状态显示为 `active (running)` 则代表服务已成功启动。

### 3.7 验证是否使用 GPU 硬编码（NVENC）

在 Omarchy（Hyprland/Wayland）环境下，Sunshine 并不一定会在启动日志中立刻显示 `nvenc`，**编码器只有在实际开始串流时才会被创建**。

因此最准确的验证方式是配合 Moonlight 实际串流来观察。

#### 方法 1：实时查看 Sunshine 日志（最直接）

打开一个终端，实时跟踪编码器创建日志：

```bash
journalctl --user -u sunshine-official.service -n 0 -f | grep -i "Creating encoder"
```

使用 Moonlight 连接并开始串流。此时终端会立刻输出一行类似以下内容：

| 日志 | 说明 |
| --- | --- |
| `Creating encoder [h264_nvenc]` 或 `hevc_nvenc]` | **成功使用 NVIDIA NVENC 硬编码（GPU 硬编码）** |
| `Creating encoder [h264_vaapi]` 或 `hevc_vaapi]` | **使用 VAAPI 硬编码（可能走核显或回退）** |
| `Creating encoder [libx264]` 或 `libx265]` | **使用 CPU 软编码（仍会造成高 CPU 占用）** |

#### 方法 2：使用 nvidia-smi 观察编码负载（辅助验证）

在串流期间，打开另一个终端运行：

```bash
nvidia-smi dmon -s u -d 1
```

重点关注 `enc` 列：

- **如果串流时 `enc` 有明显波动（5%~80%）**：说明正在使用 NVENC，确实走的是 GPU 硬编码
- **如果全程都为 `0`**：在部分驱动组合下不一定代表没用上 NVENC，但配合日志基本可以交叉验证

## 4. 访问与配置

服务启动成功后，即可访问 Sunshine 的 Web 配置界面：

```
https://localhost:47990
```

浏览器会提示自签名证书，点击继续访问即可。由于配置文件沿用 `~/.config/sunshine/`，之前在 Moonlight 中已配对的设备一般都能直接使用，无需重新配对。

在 Web 界面的 `Encoder`（编码器）选项中，可以根据实际情况选择 `NVENC`、`VAAPI` 等。修改后**记得重启服务**再进行串流测试才会生效：

```bash
systemctl --user restart sunshine-official.service
```

## 5. 总结

通过替换为 LizardByte 官方 AppImage 的方式，成功解决了 Omarchy 第三方 `sunshine` 包不支持 CUDA/NVENC 导致的 CPU 高占用与过热问题。

**核心要点总结：**

- **放弃第三方包**：`omarchy/sunshine`、`archlinuxcn/sunshine` 的构建普遍未开启 NVENC 支持，不适合 NVIDIA 用户的诉求
- **选用官方版本**：从 [LizardByte/Sunshine Releases](https://github.com/LizardByte/Sunshine/releases) 下载与 Omarchy 匹配的 AppImage（如 `v2026.1018.5342`）是最直接有效的方案
- **注意依赖与环境**：安装 `fuse2`，并在 `systemd --user` 服务中补充 NVIDIA 相关环境变量，尤其是在混合显卡（Intel + NVIDIA）环境下更为关键
- **以实测为准**：要判断是否真正用上 GPU 硬编码，必须**在 Moonlight 实际串流时**结合 `journalctl` 的 `Creating encoder [...]` 日志或 `nvidia-smi dmon` 的 `enc` 负载来确认
- **保留配置**：全程都未动 `~/.config/sunshine/`，极大降低了迁移成本

经过实际测试，切换到官方版后串流时 CPU 占用明显降低，散热也得到了改善，达到了预期效果。对于 Omarchy 用户来说，这套流程是目前最省事且最有效的解决方案。
