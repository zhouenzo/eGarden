---
title: OpenMausBot 部门配置的分享与导入：会带走什么，不会带走什么
date: 2026-11-11
draft: false
slug: openmausbot-department-sharing-import
tags:
  - OpenMausBot
  - bot配置
  - 配置共享
  - 团队协作
categories:
  - 使用指南
description: "OpenMausBot 分享和导入的是整个部门配置，而非单个 bot。本文说明配置文件包含与不包含的内容、导入后的默认状态，以及容易忽略的入口条件。"
aliases: []
featured_image: ""
lang: zh-cn
weight: 0
author: enzo
---

想把 bot 配置交给同事，先分清分享的范围：OpenMausBot 文档描述的是**分享整个部门**，不是单独导出一个 bot。

还有一个容易让人误会的细节：如果没有自建部门、只有默认部门，侧边栏里看不到 **Share department…** 入口。此时不要据此认定分享功能不存在；这个侧栏入口需要有可分享的部门。本文只说明已核对的行为，不推测如何新建部门。

## 分享与导入

分享方可以从侧边栏打开部门菜单，选择 **Share department…**，保存生成的 `.openmaus.json` 文件；也可以从 **Templates → Share** 进入。

接收方在 **Templates → Import** 导入这个文件。导入会新增一个部门，不会覆盖已有 bot；如果部门同名，系统会创建一个带编号的新部门。

## 文件里有什么

部门文件会带上：

- bot 的名称、描述、指令和外观；
- 技能文本；
- 部门共享指令、Playbooks、群聊和例程；
- 可选的 starter notes。

它不会带上聊天记录、模型选择、电脑配置、bot 访问权限、密码或密钥。应用连接只会带过去连接要求，不包含凭据；导入后需要重新配置连接。

因此，导入的是配置，不是一个已登录、已授权的完整副本。导入后例程默认暂停、技能默认关闭、连接默认关闭且凭据为空；使用前应检查配置，并按需手动启用或重新授权。

## 分享前检查隐私

starter notes 默认包含在部门文件中，分享时可以取消。生成文件前，系统会检查并脱敏疑似密钥，但这不应替代人工检查：分享前仍要确认文件里没有不该交给接收方的内容。

## 这和 Team Cloud 权限共享不同

Team Cloud 中让同事查看、聊天或编辑现有 bot，是**访问权限**的共享；`.openmaus.json` 则是**部门配置**的导入与分享。前者不等于导出配置文件，后者也不会把 bot 的访问权限一并带过去。

## 参考

- [部门共享文档](https://github.com/milind-soni/OpenMausBot/blob/main/docs/team-sharing.md)
- [Team Cloud 中 bot 访问权限说明](https://github.com/milind-soni/OpenMausBot/blob/main/docs/verification/team-bot-access.md)
