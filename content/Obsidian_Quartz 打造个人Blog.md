---
title: Obsidian_Quartz 打造个人Blog
date: 2026-03-07
draft: true
slug: ""
tags:
  - quartz
categories: []
description: ""
aliases: []
featured_image: ""
lang: zh-cn
weight: 0
author: enzo
---
文本提供 **搭建个人Blog** 的个人经验，尤其是使用Obsidian进行笔记记录的用户。基于Obsidian + Quartz4 搭建个人Blog

# Quartz4的使用 & 注意事项

[Quartz4 的文档](https://quartz.jzhao.xyz/) 已经提供了很好的说明，基本步骤按照这个来就可以，我这里提供一些踩坑经历。下面针对使用Github Pages 进行部署提出相关注意事项。

## 本地Build阶段

> [!warning]- 使用Node v22， 最新的v24 版本存在兼容性问题

v24 的node 版本会出现异常：

> [!abstract]- 异常关键片段，可对照排查
> ```
> npx quartz build --serve
> 95:     0x7ffe1cde3dd1 - ZN4node5StartEiPPc
  96:     0x7ff7815015b6 - <unknown>
  97:     0x7ff7815010d9 - <unknown>
  98:     0x7ff781501456 - <unknown>
  99:     0x7ffec461257d - BaseThreadInitThunk
 100:     0x7ffec59eaf08 - RtlUserThreadStart
thread caused non-unwinding panic. aborting.
> ```


## Github阶段

> [!warning]-  使用git clone quartz 按照指引 在本地完成build 后。立刻去看[github配置指引](https://quartz.jzhao.xyz/setting-up-your-GitHub-repository)
> 因为Quartz的结构我们的blog 是要放在git clone下的目录下来使用的，如果直接推到个人仓库，其实相当于是把quartz 项目的整个仓库fork 到了我们的blog管理中的，这个时候需要做一些个人的调整。


> [!note] git 个人仓库的 default 分支改为v4，不要使用main
> quartz的配置中，git action的脚本都是使用 **v4** 的分支，保持一致，避免后期的Host阶段遇到一些问题
********

Git修改默认分支名称：Setting -> General -> Default branch

![[Pasted image 20260307201716.png]]

## Host 阶段

**问题点**：会遇到 `Branch "v4" is not allowed to deploy to github-pages due to environment protection rules.` 错误导致，host 不成功。

![[Pasted image 20260307202929.png]]

**原因** ： github 默认不支持非 `main` 或 `master` 分支进行部署。

**解决方法** ： 在 settings -> environments 进行配置，添加`v4` 分支。

![[Pasted image 20260307203229.png]]
# Obsidian 笔记 博客分开管理技巧

保证**工作流连续性** 的同时 支持工作笔记和Blog 的 **物理隔离** 的方式。

1. 物理隔离性 ： Quartz4 的blog 目录和 个人笔记的在不同的git仓库，也不在同一个Obsidian 仓库

2. 工作流连续性 ： 通过软连接，在Obsidian的仓库下用一个目录软连接到Quarzt 的content目录。可以直接在Obsidian长库的软链接目录下进行blog编写，或者在其他目录编写后移动到这个软链接目录下。


## 软链接使用

windows 创建软链接

```
cmd //c mklink //d "source/pathA" "target/pathB"
```

## 插件 Consistent Attachments and Links 使用

> 移动md文件时，能够将对应的附件也同时挪到文件所在的附件目录中，方便文件挪动管理

> [!warning] 使用鼠标在obsidian的左侧栏拖动文件，无效。需要使用右键 ->  移动到

![[Pasted image 20260307203628.png]]