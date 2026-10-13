# 模块化报名表技术设计

日期：2026-10-12。状态：用户已审核通过；第一批基础能力已完成并通过后端验证，第二/三批尚未施工，MySQL 演练待完成。需求依据：`docs/recruitment-form-requirements.md`。

## 1. 现状与兼容边界

`RecruitmentView.vue` 当前固定渲染报名字段，`RecruitmentModels.ApplicationRequest` 固定校验基础资料、兴趣/意向标签及技术题数量，`RecruitmentService.saveOwn()` 创建/修改报名并记录首次提交历史。作品图片为独立实体与私有鉴权接口，单张 5MB。服务端使用 `RECRUITMENT_MANAGE` 管理报名，报名者按本人权限读取/编辑，初筛后不能自行修改。

模块化版本必须同步修改前端渲染和服务端校验，不能只隐藏固定字段。既有报名、接口和图片下载保持兼容；报名阶段、转正建档及新手任务逻辑沿用现行服务。

## 2. 模板、模块与版本

- 全局一个配置记录：可变草稿 schema、草稿 revision、当前已发布版本 ID、修改人/时间。
- 已发布版本独立保存不可变 schema、版本号、发布人/时间。发布在事务中检查草稿 revision、schema 合法性，再生成版本并切换当前指针；不原地改旧版本。
- schema 使用受控 JSON，不保存可执行脚本；模块有稳定 UUID、类型、标题、说明、required、displayOrder 与类型专属配置。基础信息模块内字段也有稳定 ID 和唯一系统 binding。
- 类型拟为 `BASIC_INFO`、`CHOICE`、`TEXT`、`UPLOAD`、`TECHNICAL`、`INFO`。单选/多选和文字子类型用配置区分；分组标题是 INFO 的呈现方式，保持扁平有序模块列表，不引入多层嵌套。
- 选项有稳定 ID、显示文字及顺序；答案保存选项 ID，而非可变标题。复制模块/选项生成新 ID，排序不改 ID，禁止 ID 重复或重复系统 binding。
- BASIC_INFO 全表恰好一个，TECHNICAL 最多一个；核心姓名/邮箱/专业/班级字段的含义、类型和必填性受保护。普通模块可以多次出现。

## 3. 数据模型与存量处理

拟增加 `recruitment_form_config`、`recruitment_form_versions`、`recruitment_form_attachments` 和用于提交去重的 `recruitment_form_submissions`；报名表增加可空 `form_version_id`、动态答案 JSON 字段及答案 revision。提交记录对“账号 + requestKey”唯一，保存请求摘要、关联报名和处理结果；答案 revision 用于拒绝同一报名的过时覆盖。schema 与答案在 MySQL 使用 LONGTEXT，由应用进行结构与长度校验，避免依赖测试 H2 与 MySQL 不同的 JSON 行为。

- 新报名保存所用版本 ID 与按模块 ID 索引的答案；基础字段同步到既有报名实体供列表、面试和转正建档使用。方向/技能/意向等既有展示字段通过默认模块 binding 同步；普通新增问题只进入动态答案。
- TECHNICAL 启用时保存实际分配的题目 ID 和内容快照，继续校验 5 道分配、至少 3 道有效作答。停用的新版本不要求技术回答；旧接口/旧报名仍按原规则处理，不用空白假答案绕过校验。
- `form_version_id IS NULL` 的旧报名由 legacy 渲染器显示现有字段、技术题及图片，不强行绑定新版，不做存量答案重写。
- 动态审核详情读取该报名引用的版本；模块文字、选项、排序、附件与答案来自同一版本，不能读取当前模板后拼接历史答案。
- 既有服务字段长度、邮箱/电话规则继续有效；动态接口按 schema 决定普通字段的必填性，而不是复用所有固定 DTO 注解。关闭普通默认模块时同步目标为真实空集合/可空值，不填虚构内容。

## 4. 服务与接口（拟定）

管理接口使用 `RECRUITMENT_MANAGE`：

- `GET /api/v1/admin/recruitment/form`：草稿、revision 和当前发布摘要。
- `PUT /api/v1/admin/recruitment/form/draft`：提交完整有界 schema 与预期 revision，乐观锁冲突返回 409。
- `POST /api/v1/admin/recruitment/form/publish`：按指定 revision 发布并记录操作人/时间；即便连续点击也不重复发布同一草稿。

报名者接口仍要求登录及本人权限：

- `GET /api/v1/recruitment/me/form`：有模块化报名时返回其绑定版本；没有报名时返回当前发布版本；旧报名返回 legacy 标记，原读取接口继续可用。
- `PUT /api/v1/recruitment/me/modular`：multipart 提交版本 ID、答案、已有附件 ID 与新文件；首次成功创建报名时绑定版本。服务器按版本校验所有模块与文件，不信任客户端提交的 required/type/限制。
- `GET /api/v1/recruitment/applications/{applicationId}/form-attachments/{attachmentId}`：核对本人或管理权限、附件归属后下载；PDF以 attachment 响应，图片允许鉴权读取后的前端 Blob 预览，均加 nosniff，不提供静态公开文件路径。

首次提交必须使用当前发布版本；旧页面遇到新版返回 409，前端保存相容输入并提示重新核对。已存在报名仅允许绑定版本，不能靠提交别的版本 ID 迁移旧答案。初筛后的修改在进入文件写入前被拒绝。

## 5. 提交与文件一致性

- 文件选择和未提交文本为浏览器草稿，不为了上传提前创建正式报名。提交时以受控键将每份文件映射到上传模块；已有报名引用旧附件时只允许使用本人的同模块附件。
- 先校验身份、阶段、模板版本、文本/选择答案及文件数量/大小/格式，再为本次新文件生成随机存储名。校验和数据库写入失败时只清理本次创建且尚未成为业务附件的临时文件，核对规范化路径边界。
- 报名、答案、附件归属及首次状态历史在同一事务内写入；事务/文件异常不生成半份有效报名。相同提交 requestKey 与内容重试返回原结果，内容不同则拒绝复用 key，避免重复附件。
- 已经提交的业务附件移除采用解除当前引用/保留记录；本批不新增既有业务文件物理清理。旧图片实体与下载路径继续可读，不移动或删除已有文件。
- 图片沿用白名单格式和真实文件检测，PDF新增真实格式验证；文件名仅作展示，不能决定磁盘路径。限制单模块、全表及请求总大小，错误返回模块/文件定位信息。
- 当前全局 multipart 单文件上限 20MB、请求上限 80MB，可容纳本需求的 5MB/10MB 文件与 50MB 全表上限；领域校验仍使用更严格的模块限额。

## 6. 前端

- 在 `AdminRecruitmentView` 增加“报名管理 / 报名表设置”视图切换。编辑区呈现模块顺序列表、选中模块配置、添加模块菜单和预览；桌面可并排，手机堆叠。
- 可复用模块渲染器供报名、预览和审核只读使用，依据模式控制编辑/上传，服务器仍独立鉴权。技术与基础资料的现有组件可提取复用，不把阶段、面试和新手任务放入模板编辑器。
- 顺序调整提供上移/下移及选项排序；复制生成新 ID，删除有明确反馈。动态字段生成稳定 label/input ID，错误摘要链接到模块，保留输入与附件失败信息。
- 发布与草稿保存分别反馈；离开未保存编辑时沿用 `useUnsavedGuard`，并发冲突保留本地内容供对比。
- 本地草稿键含账号、表单版本；新版只恢复 ID、类型与选项仍相容的答案，废弃项显式提示。文件未上传成功不伪装为已保存，刷新后需重新选择时说明。
- 现有 MASTER 与预设为视觉权威，控件 44px、文字对比度 4.5:1、可见焦点、减少动态、无页面横向溢出；不使用生成器覆盖设计存档。
- 规则来源：`ui-ux-pro-max` 的 `form labels inline validation --domain ux` 命中 Form Labels、Inline Validation，采用显式标签和就地校验；`form grouping progressive disclosure --domain ux` 仅命中提交反馈/标签，不把它宣称为分组模式依据，分组来自本次实际表单结构与已有设计规范。

## 7. 迁移与人工验收

施工前源码最高迁移 V22，V22 历史提交为 `fe925ed`；已确认编号可用并新增 `V23__recruitment_form.sql`，不修改任何既有迁移。版本与答案列允许为空，答案 revision 为非空且默认 0；新增表/列采取缺什么补什么，不修改旧 ENUM，不自动升级未审计的生产库。V23 尚未在实际 MySQL 执行。

上线前必须：备份业务数据库和上传目录；读取并核对生产 `flyway_schema_history` 与源码迁移历史/校验和；在预生产 MySQL 演练从现有库升级，检查旧报名/图片/阶段可读、默认模板与新字段正确、迁移重跑不破坏记录。生产迁移审计未确认则停在上线前，不用 repair 绕过问题。

部署后核对新增表、默认模板、存量报名数/阶段和附件可读性，按专用测试账号跑新提交、旧表修改、技术开关和新版发布场景；记录结果。临时 MySQL 只使用 `scripts/temp-mysql.sh` 并当轮关停；不得删除业务数据或上传文件。

## 8. 施工批次与验证

1. 数据结构、模板/版本服务、配置校验与权限；先测试版本不可变、发布幂等和并发冲突。
2. 动态提交、基础字段映射、技术开关、附件事务及 legacy 兼容；测试旧表/新表、版本竞争、阶段锁定、非法答案与越权文件读取。
3. 管理编辑器、共用渲染器、报名/审核接入、使用文档和实际 UI 截图；端到端组合两个以上同类型模块、排序、预览、发布、新旧报名及错误恢复。

每个施工批次单独收口并写入 DEVLOG，不在一次会话里跨越全部批次。最终执行前端检查、相关后端测试、真实浏览器验收与 MySQL 人工演练；H2 构建/测试不替代迁移实机验证。本轮仅交付待审设计，不创建表或改业务代码。

## 9. 第一批实现与第二批交接（2026-10-12）

### 已实现的接口与协议

- `GET /api/v1/admin/recruitment/form` 返回 `draft`、`draftRevision`、`updatedBy`、`updatedAt`、完整 `published` 版本和 `hasUnpublishedChanges`。
- 保存草稿 `PUT .../form/draft` 请求为 `{expectedRevision, schema}`；发布 `POST .../form/publish` 请求为 `{expectedRevision}`，expectedRevision 必须明确提供且非负。两者都基于 draftRevision；同内容重复保存不会制造新发布版本。发布不增加 draftRevision，只更新 publishedDraftRevision 与当前版本指针。
- `GET .../form/versions/{versionId}` 为管理员读取历史快照；不存在时 404。版本实体不可更新，接口没有修改/删除已发布版本入口。
- `GET /api/v1/recruitment/me/form` 返回 `{legacy, form}`。既有无版本报名为 `{legacy:true, form:null}`；无报名则读取当前发布版本；已有绑定版本的报名读取原版本。申请者 form 仅含 `id`、`versionNumber`、`schema`，不暴露管理员发布人信息。
- 管理方法要求 RECRUITMENT_MANAGE；本人读取要求 RECRUITMENT_SELF_VIEW，且从认证账号查询报名，不能提供别人的申请 ID 切换上下文。

### Schema 与校验

当前 schemaVersion 为 1，顶层字段 `title`、`description`、`modules`。模块字段与设置以 `RecruitmentFormModels.java` 为准：`id/type/title/description/required/enabled/displayOrder/binding/fields/options/choice/text/upload`。

- 模块、基础字段、选项的 UUID 在一张表内唯一；各层 displayOrder 唯一且为 0—999，渲染时按该值排序，不以数组下标作答案 ID。
- BASIC_INFO 恰好一个且启用，NAME/EMAIL/MAJOR/CLASS_NAME 保持启用并必填；TECHNICAL 最多一个且只能通过 enabled 停用，启用时仍为 5 选 3。
- 普通选择模块最多 30 项；兴趣方向 binding 的选项文字限制 80 字，其他选择文字 100 字，防止既有投影字段溢出。TEXT 的 TAG_LIST/LINK_LIST 使用 maxEntries；maxLength 作用于列表项，分别最多 50/8 项，其余文字格式不接受 maxEntries。
- 默认模板含 10 个模块，当前作品图片模块只允许 IMAGE；可另加 IMAGE/PDF 上传模块。单模块文件上限 6、图片 5MB、PDF 10MB；有效必填上传模块不能超过全表 20 份最低需求上限，禁止发布无法完成的表单。
- schema 序列化后 UTF-8 总量不超过 256KB。错误响应 `fields` 用 `schema.modules[i]...` 路径定位配置项；旧业务 ApiException 的 fields 仍默认为空，兼容原响应。

### 第二批需要完成

- 新的 multipart 动态提交接口尚不存在，当前报名页面和原 PUT /me 仍走旧固定表单。不要把“模板可发布”解释为报名界面已经切换。
- 附件、提交去重表与实体已建模，但尚无仓储、存储/下载实现；报名实体提供版本/答案/revision 读取字段，尚无动态写入方法。
- 首次提交在最终写入事务中锁定全局配置并核对当前已发布版本，以免校验后遇到管理员发布而绑定过时模板；已有报名锁定报名行并核对答案 revision，保留其原版本。文件预校验/临时处理不应先创建正式报名。
- 明确普通字段 binding 到原报名资料的投影；自定义答案只进入 JSON。技术题在首次成功提交保存题目内容快照；enabled=false 的新版不要求作答，不影响旧表/原绑定版本。
- V23 的 form_version_id、form_answers_json 允许为空，form_answers_revision 默认 0；null 版本记录保留 legacy。不要批量写入版本或重新解释旧答案。

## 10. V23 人工迁移验收步骤（未执行）

本机未发现可执行的 mysql/mysqld 或 Docker，不进行临时 MySQL 安装，也不手工启动 mysqld。下列步骤需在具备 MySQL 的专用预生产副本执行；构建和 H2 测试不覆盖 SQL。

1. 备份目标数据库与上传目录，保存 `flyway_schema_history` 全部版本/校验和、报名总数与各阶段数量、作品图片总数。核对当前仓库历史：V22 引入提交 fe925ed，V23 为本批新文件；历史校验和未审计通过则停止升级，禁止 repair。
2. 确认已有 accounts、recruitment_applications 的主键类型为 BINARY(16)，表引擎支持外键；记录 MySQL 版本。专用副本执行 V23，检查四张新表及外键、版本号唯一约束、账号/requestKey 唯一约束和附件 storedName 唯一约束。
3. 核对旧报名的 form_version_id/form_answers_json 均为 NULL，form_answers_revision 为 0；总数、阶段、答案和图片不变。脚本不复制或删除任何旧文件，不为旧报名绑定新版。
4. 在副本再次直接执行同一 V23 SQL，确认已存在表、列和外键不重复创建；再次核对前述业务数量与内容。仅重复检查新增脚本，不篡改 Flyway 历史记录。
5. 启动对应新版后端：先执行迁移/ORM 检查，再由初始化器在单个事务中生成 SYSTEM 发布的默认版本 1 与全局配置行；重复启动不增版本、不改草稿。管理员读取看到 10 模块和四个核心必填字段；旧报名仍返回 legacy。
6. 用专用账号验证草稿保存不改变当前发布、发布不改旧快照、两个相同发布请求只生成一个版本、两个同 revision 编辑一个成功一个冲突。H2 已验证应用行为，这一步用于实际 InnoDB 复核。
7. 部署后复核迁移历史中 V23 的成功状态与校验和、新表/新列、默认版本及旧报名/图片可读；完成第二/三批后再验收动态报名和附件。必要时停止新版服务并按经过审核的备份恢复方案处理，不删除业务目录或使用 docker compose down -v。
8. 如果需要临时 MySQL，必须使用 scripts/temp-mysql.sh 配置 TTL/日志上限，本批/当轮收尾 stop，并在 DEVLOG 记录已关停。
