package cn.openlims.platform.config;

import cn.openlims.platform.achievement.model.CompetitionEntity;
import cn.openlims.platform.achievement.model.CompetitionLevel;
import cn.openlims.platform.achievement.model.CompetitionLifecycle;
import cn.openlims.platform.achievement.model.CompetitionParticipantEntity;
import cn.openlims.platform.achievement.model.CompetitionResultStatus;
import cn.openlims.platform.achievement.model.NewsEntity;
import cn.openlims.platform.achievement.model.VerificationStatus;
import cn.openlims.platform.achievement.repository.CompetitionRepository;
import cn.openlims.platform.achievement.repository.NewsRepository;
import cn.openlims.platform.discussion.model.DiscussionPostEntity;
import cn.openlims.platform.discussion.model.DiscussionReplyEntity;
import cn.openlims.platform.discussion.repository.DiscussionPostRepository;
import cn.openlims.platform.discussion.repository.DiscussionReplyRepository;
import cn.openlims.platform.fund.api.FundModels;
import cn.openlims.platform.fund.model.FundEntryType;
import cn.openlims.platform.fund.service.FundService;
import cn.openlims.platform.identity.model.AccountEntity;
import cn.openlims.platform.identity.model.MemberProfileEntity;
import cn.openlims.platform.identity.model.MemberStatus;
import cn.openlims.platform.identity.model.Role;
import cn.openlims.platform.identity.repository.AccountRepository;
import cn.openlims.platform.identity.repository.MemberProfileRepository;
import cn.openlims.platform.points.api.PointModels;
import cn.openlims.platform.points.model.PointSubcategory;
import cn.openlims.platform.points.service.PointService;
import cn.openlims.platform.project.model.ProjectStatus;
import cn.openlims.platform.project.model.ProjectTeamEntity;
import cn.openlims.platform.project.model.ProjectType;
import cn.openlims.platform.project.repository.ProjectTeamRepository;
import cn.openlims.platform.recruitment.model.RecruitmentApplicationEntity;
import cn.openlims.platform.recruitment.model.RecruitmentStage;
import cn.openlims.platform.recruitment.repository.RecruitmentApplicationRepository;
import cn.openlims.platform.task.api.TaskModels;
import cn.openlims.platform.task.service.BountyService;
import cn.openlims.platform.task.repository.TaskRepository;
import cn.openlims.platform.task.service.TaskService;
import org.hibernate.Hibernate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Example content for a freshly cloned OpenLIMS so every module has something to show:
 * members, projects, tasks, bounties, awards, news, discussions, points, fund and applications.
 *
 * <p>Runs after {@link BootstrapDataConfig}. {@code openlims.security.bootstrap.demo-content} is
 * {@code auto} by default, which seeds only the embedded H2 database used for local trials; a MySQL
 * deployment never receives example records unless it is set to {@code true}. Seeding happens once:
 * the first example account doubles as the marker.</p>
 */
@Component
@Order(200)
@ConditionalOnProperty(name = "openlims.security.bootstrap.enabled", havingValue = "true")
public class DemoContentSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DemoContentSeeder.class);
    private static final String MARKER_USERNAME = "demo.zhou";
    private static final String COMPLETION_MARKER = "官网 Lighthouse 跑分提到 90";
    private static final ZoneId LAB_ZONE = ZoneId.of("Asia/Shanghai");

    private final AccountRepository accounts;
    private final MemberProfileRepository profiles;
    private final ProjectTeamRepository projects;
    private final CompetitionRepository competitions;
    private final NewsRepository news;
    private final DiscussionPostRepository posts;
    private final DiscussionReplyRepository replies;
    private final RecruitmentApplicationRepository applications;
    private final TaskService taskService;
    private final TaskRepository tasks;
    private final BountyService bountyService;
    private final PointService pointService;
    private final FundService fundService;
    private final PasswordEncoder passwords;
    private final TransactionTemplate transactions;
    private final String mode;
    private final String datasourceUrl;
    private final String memberPassword;

    public DemoContentSeeder(
            AccountRepository accounts,
            MemberProfileRepository profiles,
            ProjectTeamRepository projects,
            CompetitionRepository competitions,
            NewsRepository news,
            DiscussionPostRepository posts,
            DiscussionReplyRepository replies,
            RecruitmentApplicationRepository applications,
            TaskService taskService,
            TaskRepository tasks,
            BountyService bountyService,
            PointService pointService,
            FundService fundService,
            PasswordEncoder passwords,
            TransactionTemplate transactions,
            @Value("${openlims.security.bootstrap.demo-content:auto}") String mode,
            @Value("${spring.datasource.url:}") String datasourceUrl,
            @Value("${openlims.security.bootstrap.member-password}") String memberPassword
    ) {
        this.accounts = accounts;
        this.profiles = profiles;
        this.projects = projects;
        this.competitions = competitions;
        this.news = news;
        this.posts = posts;
        this.replies = replies;
        this.applications = applications;
        this.taskService = taskService;
        this.tasks = tasks;
        this.bountyService = bountyService;
        this.pointService = pointService;
        this.fundService = fundService;
        this.passwords = passwords;
        this.transactions = transactions;
        this.mode = mode == null ? "auto" : mode.trim().toLowerCase();
        this.datasourceUrl = datasourceUrl == null ? "" : datasourceUrl;
        this.memberPassword = memberPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean enabled = switch (mode) {
            case "true" -> true;
            case "false" -> false;
            default -> datasourceUrl.startsWith("jdbc:h2:");
        };
        // The last bounty is created at the very end, so its presence means a previous run finished.
        if (!enabled || taskExists(COMPLETION_MARKER)) return;
        MemberProfileEntity teacher = loadProfile("T-001");
        if (teacher == null) return;
        try {
            seed(teacher);
            log.info("OpenLIMS example content seeded (members, projects, tasks, bounties, awards, discussions).");
        } catch (RuntimeException exception) {
            log.warn("OpenLIMS example content was only partly seeded: {}", exception.getMessage());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void seed(MemberProfileEntity teacherProfile) {
        LocalDate today = LocalDate.now(LAB_ZONE);
        Map<String, MemberProfileEntity> people = transactions.execute(status -> createPeople());
        MemberProfileEntity zhou = people.get("zhou");
        MemberProfileEntity chen = people.get("chen");
        MemberProfileEntity xu = people.get("xu");
        MemberProfileEntity song = people.get("song");
        MemberProfileEntity he = people.get("he");
        MemberProfileEntity core = java.util.Objects.requireNonNullElse(loadProfile("S-CORE-001"), zhou);
        MemberProfileEntity member = java.util.Objects.requireNonNullElse(loadProfile("S-001"), xu);
        AccountEntity teacher = teacherProfile.getAccount();

        Map<String, ProjectTeamEntity> demoProjects = transactions.execute(status ->
                createProjects(teacher, teacherProfile, zhou, chen, xu, song, he, core, today));
        step("achievements", () -> transactions.executeWithoutResult(status ->
                createAchievements(teacher, teacherProfile, zhou, chen, xu, he, today)));
        step("discussions", () -> transactions.executeWithoutResult(status ->
                createDiscussions(teacher, zhou, chen, xu, song, core)));
        step("applications", () -> transactions.executeWithoutResult(status -> createApplications(today)));

        Authentication admin = authenticate(teacher);
        step("fund", () -> createFund(admin, today));
        step("points", () -> createPoints(admin, demoProjects, zhou, chen, xu, song, he, core, member, today));
        step("tasks", () -> createTasks(admin, teacherProfile, zhou, xu, song, he, core, member, today));
        step("bounties", () -> createBounties(admin, zhou, chen, xu, song, he, today));
    }

    // ---------- people ----------

    private Map<String, MemberProfileEntity> createPeople() {
        return Map.of(
                "zhou", person(MARKER_USERNAME, Role.CORE_STUDENT, "周以宁", "S-CORE-101", "计算机科学", "计科 2301", "2023",
                        List.of("SLAM", "C++", "ROS 2"), "把建图做到走廊尽头",
                        "<p>负责四旋翼室内自主建图，关注视觉惯性里程计与回环检测。</p>"),
                "chen", person("demo.chen", Role.CORE_STUDENT, "陈屿", "S-CORE-102", "自动化", "自动化 2402", "2024",
                        List.of("机械臂", "视觉", "PyTorch"), "让机械臂学会挑零件",
                        "<p>机械臂视觉抓取项目负责人，带队参加全国大学生机器人大赛。</p>"),
                "xu", person("demo.xu", Role.MEMBER, "许安", "S-201", "人工智能", "人工智能 2401", "2024",
                        List.of("仿真", "Python", "强化学习"), "在仿真里先摔一千次",
                        "<p>负责多机编队仿真环境，喜欢把算法先在仿真里跑通。</p>"),
                "song", person("demo.song", Role.MEMBER, "宋青禾", "S-301", "软件工程", "软工 2501", "2025",
                        List.of("前端", "Vue", "设计"), "把实验室平台做得更好用",
                        "<p>参与 OpenLIMS 平台开发，负责成员系统的界面与交互。</p>"),
                "he", person("demo.he", Role.MEMBER, "何川", "S-302", "电子信息", "电信 2502", "2025",
                        List.of("嵌入式", "STM32", "PCB"), "从焊第一块板开始",
                        "<p>新加入的嵌入式方向成员，正在给机器狗做传感器扩展板。</p>")
        );
    }

    private MemberProfileEntity person(String username, Role role, String name, String code, String major,
                                       String className, String grade, List<String> tags, String headline, String html) {
        MemberProfileEntity existing = profiles.findByMemberCodeIgnoreCase(code).orElse(null);
        if (existing != null) {
            Hibernate.initialize(existing.getAccount());
            return existing;
        }
        AccountEntity account = accounts.findByUsernameIgnoreCase(username)
                .orElseGet(() -> accounts.save(new AccountEntity(username, passwords.encode(memberPassword), role)));
        MemberProfileEntity profile = new MemberProfileEntity(account, name, code, major, className, grade,
                username + "@openlims.internal", MemberStatus.OFFICIAL, tags);
        profile.updateEditableFields(username + "@openlims.internal", headline, html);
        return profiles.save(profile);
    }

    // ---------- projects ----------

    private Map<String, ProjectTeamEntity> createProjects(AccountEntity teacher, MemberProfileEntity advisor,
                                                         MemberProfileEntity zhou, MemberProfileEntity chen,
                                                         MemberProfileEntity xu, MemberProfileEntity song,
                                                         MemberProfileEntity he, MemberProfileEntity core, LocalDate today) {
        ProjectTeamEntity mapping = project(teacher, advisor, zhou, List.of(zhou, xu, core), "四旋翼室内自主建图", "MAPPING / 02",
                "只用机载相机与 IMU，在没有 GPS 的走廊里实时建图并完成回环。", ProjectType.RESEARCH, ProjectStatus.ACTIVE,
                List.of("SLAM", "视觉惯性里程计", "四旋翼"), today.minusMonths(5), today.plusMonths(3),
                List.of("完成标定与数据采集", "实现实时回环", "整理论文与开源代码"),
                "已在教学楼走廊完成 120 米闭环建图，正在优化弱纹理区域的定位漂移。",
                "建图精度较基线提升 23%，相关论文已被会议接收。");
        ProjectTeamEntity grasp = project(teacher, advisor, chen, List.of(chen, he, core), "机械臂视觉抓取", "GRASP / 03",
                "六轴机械臂识别桌面上的零件并分类抓取，面向机器人竞赛的工业分拣场景。", ProjectType.COMPETITION, ProjectStatus.ACTIVE,
                List.of("机械臂", "目标检测", "手眼标定"), today.minusMonths(8), today.plusMonths(1),
                List.of("完成手眼标定", "抓取成功率达到 90%", "参加国赛"),
                "抓取成功率已从 71% 提升到 93%，正在准备决赛演示。",
                "全国大学生机器人大赛二等奖。");
        ProjectTeamEntity swarm = project(teacher, advisor, xu, List.of(xu, zhou), "多机编队飞行仿真", "SWARM / 04",
                "在仿真环境里验证 8 架四旋翼的编队保持与分布式避碰算法。", ProjectType.RESEARCH, ProjectStatus.PLANNING,
                List.of("多智能体", "仿真", "强化学习"), today.minusWeeks(3), today.plusMonths(6),
                List.of("搭建仿真环境", "实现编队保持", "迁移到实机"),
                "仿真环境已搭建，正在实现基于一致性的编队控制。", "");
        ProjectTeamEntity platform = project(teacher, advisor, song, List.of(song, core, he), "OpenLIMS 开源实验室平台", "PLATFORM / 05",
                "实验室自用的协作平台：招新、任务、悬赏、积分、基金与讨论板，整理后开源。", ProjectType.OPEN_SOURCE, ProjectStatus.ACTIVE,
                List.of("Vue", "Spring Boot", "交互设计"), today.minusMonths(10), null,
                List.of("开源发布", "完善成员端交互", "补齐部署文档"),
                "首页与成员端交互正在改版，新增了今日页和命令面板。", "已开源，任务、积分、招新全部可用。");
        return Map.of("mapping", mapping, "grasp", grasp, "swarm", swarm, "platform", platform);
    }

    private ProjectTeamEntity project(AccountEntity teacher, MemberProfileEntity advisor, MemberProfileEntity leader,
                                      List<MemberProfileEntity> members, String name, String team, String description,
                                      ProjectType type, ProjectStatus status, List<String> tags, LocalDate start,
                                      LocalDate end, List<String> goals, String progress, String outcomes) {
        ProjectTeamEntity existing = projects.findAll().stream()
                .filter(item -> item.getProjectName().equals(name)).findFirst().orElse(null);
        if (existing != null) return existing;
        ProjectTeamEntity project = new ProjectTeamEntity(name, team, description, type, status, leader, advisor, teacher);
        project.updateDetails(name, description, type, status, advisor, tags, start, end, goals, progress,
                outcomes.isBlank() ? null : outcomes, null, null, true);
        project.updateTeam(team, leader, new LinkedHashSet<>(members), new LinkedHashSet<>());
        return projects.save(project);
    }

    // ---------- achievements & news ----------

    private void createAchievements(AccountEntity teacher, MemberProfileEntity advisor, MemberProfileEntity zhou,
                                    MemberProfileEntity chen, MemberProfileEntity xu, MemberProfileEntity he, LocalDate today) {
        if (competitions.findAll().stream().anyMatch(item -> item.getName().equals("全国大学生机器人大赛"))) return;
        award(teacher, advisor, chen, List.of(he, xu), "全国大学生机器人大赛", "工业分拣赛道", CompetitionLevel.NATIONAL,
                "二等奖", "视觉组 4 人参赛，机械臂抓取方案进入决赛。", today.minusMonths(4), 0, true);
        award(teacher, advisor, zhou, List.of(xu), "省大学生电子设计竞赛", "无人机赛道", CompetitionLevel.PROVINCIAL,
                "一等奖", "四旋翼自主巡线与投放任务全部完成。", today.minusMonths(7), 1, true);
        award(teacher, advisor, he, List.of(chen), "RoboMaster 高校联盟赛", "步兵机器人", CompetitionLevel.REGIONAL,
                "三等奖", "首次参赛，电控与视觉组联合完成步兵机器人。", today.minusDays(20), 2, false);

        news.save(new NewsEntity("实验室空地协同系统完成首次户外联调", "校园新闻网", "https://example.com/openlims/air-ground",
                "四旋翼回传的俯视地图引导机器狗绕过 3 处障碍到达目标点。", today.minusDays(12), true, teacher));
        news.save(new NewsEntity("学生团队获全国大学生机器人大赛二等奖", "学院公众号", "https://example.com/openlims/robot-contest",
                "机械臂视觉抓取方案在工业分拣赛道获得二等奖。", today.minusMonths(4), true, teacher));
        news.save(new NewsEntity("OpenLIMS 实验室协作平台开源", "开源社区", "https://example.com/openlims/release",
                "实验室把自用的招新、任务、积分平台整理后开源。", today.minusMonths(6), true, teacher));
    }

    private void award(AccountEntity teacher, MemberProfileEntity advisor, MemberProfileEntity captain,
                       List<MemberProfileEntity> teammates, String name, String track, CompetitionLevel level,
                       String awardName, String description, LocalDate date, int order, boolean approved) {
        CompetitionEntity item = new CompetitionEntity(name, level, CompetitionLifecycle.FINISHED, description,
                captain, captain.getAccount());
        item.updateDetails(name, track, level, CompetitionLifecycle.FINISHED, awardName, description, date,
                null, null, advisor, advisor.getName(), null);
        item.setResultStatus(CompetitionResultStatus.AWARDED);
        List<CompetitionParticipantEntity> participants = new ArrayList<>();
        participants.add(new CompetitionParticipantEntity(captain.getName(), captain, true, 0));
        for (int index = 0; index < teammates.size(); index++) {
            participants.add(new CompetitionParticipantEntity(teammates.get(index).getName(), teammates.get(index), false, index + 1));
        }
        item.replaceParticipants(participants);
        if (approved) {
            item.review(VerificationStatus.APPROVED, "示例数据：已核对获奖证明。", teacher);
            item.updateDisplay(true, order);
        } else {
            item.markPending();
        }
        competitions.save(item);
    }

    // ---------- discussions ----------

    private void createDiscussions(AccountEntity teacher, MemberProfileEntity zhou, MemberProfileEntity chen,
                                   MemberProfileEntity xu, MemberProfileEntity song, MemberProfileEntity core) {
        if (posts.findAll().stream().anyMatch(post -> post.getTitle().equals("本学期组会安排与项目分组"))) return;
        DiscussionPostEntity welcome = posts.save(new DiscussionPostEntity(teacher, "本学期组会安排与项目分组",
                "<p>本学期组会改到每周四晚 7 点，各项目组轮流汇报。新同学请先完成新手任务，再到对应项目群里找负责人。</p>", false));
        welcome.togglePinned();
        posts.save(welcome);
        replies.save(new DiscussionReplyEntity(welcome, zhou.getAccount(), "<p>建图组这周汇报回环检测的进展，会带走廊实测视频。</p>"));
        replies.save(new DiscussionReplyEntity(welcome, song.getAccount(), "<p>平台组下周演示新的今日页和命令面板。</p>"));

        DiscussionPostEntity lidar = posts.save(new DiscussionPostEntity(zhou.getAccount(), "弱纹理走廊里定位漂移怎么处理？",
                "<p>白墙走廊特征点太少，VIO 漂移明显。大家有试过加线特征或者轮速计约束吗？</p>", false));
        replies.save(new DiscussionReplyEntity(lidar, xu.getAccount(), "<p>仿真里加线特征效果不错，可以先在数据集上验证。</p>"));
        replies.save(new DiscussionReplyEntity(lidar, chen.getAccount(), "<p>试试在墙上贴几张 AprilTag 做辅助，比赛时很稳。</p>"));

        posts.save(new DiscussionPostEntity(core.getAccount(), "机器狗传感器扩展板采购清单",
                "<p>扩展板需要 IMU、TOF 测距和 CAN 收发器，清单整理在项目文档里，预算从实验室基金走。</p>", false));
        posts.save(new DiscussionPostEntity(chen.getAccount(), "国赛复盘：机械臂抓取从 71% 到 93%",
                "<p>主要三点：重新做手眼标定、抓取点改用法向估计、加了失败重试。详细复盘写在项目空间。</p>", false));
    }

    // ---------- recruitment ----------

    private void createApplications(LocalDate today) {
        application("demo.applicant1", "林小舟", "机械工程", "机械 2501", "2025", RecruitmentStage.SIGNUP,
                List.of("机器人", "嵌入式"), List.of("Arduino", "SolidWorks"), "高中参加过机器人社团，做过循迹小车。");
        application("demo.applicant2", "苏一禾", "计算机科学", "计科 2502", "2025", RecruitmentStage.SCREENING,
                List.of("视觉", "人工智能"), List.of("Python", "OpenCV"), "自学过 YOLO，做过垃圾分类识别的小项目。");
    }

    private void application(String username, String name, String major, String className, String grade,
                             RecruitmentStage stage, List<String> interests, List<String> skills, String experience) {
        if (accounts.findByUsernameIgnoreCase(username).isPresent()) return;
        AccountEntity account = accounts.save(new AccountEntity(username, passwords.encode(memberPassword), Role.VISITOR));
        RecruitmentApplicationEntity item = new RecruitmentApplicationEntity(account, name, major, className, grade,
                username + "@example.com", interests, skills, experience, List.of("工程实现"));
        item.updateContactDetails(username + "@example.com", "13800000000", username, "示例报名：希望加入实验室参与真实项目。");
        if (stage != RecruitmentStage.SIGNUP) item.changeStage(stage);
        applications.save(item);
    }

    // ---------- fund ----------

    private void createFund(Authentication admin, LocalDate today) {
        as(admin, () -> {
            fundService.create(admin, new FundModels.EntryRequest(FundEntryType.OPENING, new BigDecimal("20000.00"),
                    today.minusDays(36), "学年期初余额", "示例数据", key("fund-opening")), true);
            fundService.create(admin, new FundModels.EntryRequest(FundEntryType.INCOME, new BigDecimal("5000.00"),
                    today.minusDays(22), "学院创新实践专项拨款", "示例数据", key("fund-income")), false);
            fundService.create(admin, new FundModels.EntryRequest(FundEntryType.EXPENSE, new BigDecimal("1280.00"),
                    today.minusDays(17), "采购激光雷达配件", "空地协同项目", key("fund-lidar")), false);
            fundService.create(admin, new FundModels.EntryRequest(FundEntryType.EXPENSE, new BigDecimal("860.00"),
                    today.minusDays(5), "机器人大赛报名费", "RoboMaster 高校联盟赛", key("fund-contest")), false);
            return null;
        });
    }

    // ---------- points ----------

    private void createPoints(Authentication admin, Map<String, ProjectTeamEntity> demoProjects,
                              MemberProfileEntity zhou, MemberProfileEntity chen, MemberProfileEntity xu,
                              MemberProfileEntity song, MemberProfileEntity he, MemberProfileEntity core,
                              MemberProfileEntity member, LocalDate today) {
        List<MemberProfileEntity> crew = List.of(zhou, chen, xu, song, he, core, member);
        String[] titles = {"组会技术分享", "实验室开放日讲解", "整理设备借用台账", "撰写项目周报", "录制项目演示视频",
                "维护仿真环境镜像", "协助新生环境搭建", "校对比赛技术文档"};
        int grant = 0;
        for (int day = 56; day >= 1; day -= 3) {
            MemberProfileEntity first = crew.get(grant % crew.size());
            MemberProfileEntity second = crew.get((grant + 3) % crew.size());
            int points = 6 + (grant * 7) % 13;
            int split = Math.max(1, points / 2);
            String title = titles[grant % titles.length];
            LocalDate occurredOn = today.minusDays(day);
            int index = grant;
            as(admin, () -> pointService.grant(admin, new PointModels.ManualGrantRequest(title, PointSubcategory.MEDIA_CONTENT,
                    occurredOn, points, key("points-" + index), null, null, "示例数据",
                    List.of(new PointModels.AllocationRequest(first.getId(), split, "主要负责"),
                            new PointModels.AllocationRequest(second.getId(), points - split, "协助完成")))));
            grant++;
        }
        ProjectTeamEntity mapping = demoProjects.get("mapping");
        as(admin, () -> pointService.grant(admin, new PointModels.ManualGrantRequest("走廊闭环建图阶段验收",
                PointSubcategory.PROJECT_TASK, today.minusDays(9), 40, key("points-mapping"), null, mapping.getId(), "示例数据",
                List.of(new PointModels.AllocationRequest(zhou.getId(), 24, "算法实现与实测"),
                        new PointModels.AllocationRequest(xu.getId(), 16, "数据采集与评估")))));
    }

    // ---------- tasks ----------

    private void createTasks(Authentication admin, MemberProfileEntity teacher, MemberProfileEntity zhou,
                             MemberProfileEntity xu, MemberProfileEntity song, MemberProfileEntity he,
                             MemberProfileEntity core, MemberProfileEntity member, LocalDate today) {
        if (taskExists("组会周报（第 6 周）")) return;
        TaskModels.TaskView weekly = as(admin, () -> taskService.createStandardTask(admin, new TaskModels.CreateTaskRequest(
                "组会周报（第 6 周）", "<p>每人一页：本周进展、遇到的问题、下周计划。</p>", today.minusDays(2), today.plusDays(10), 5,
                List.of(new TaskModels.SubtaskInput(null, "填写周报模板", "<p>模板在讨论板置顶帖里。</p>")),
                List.of(), List.of(teacher.getId(), zhou.getId(), xu.getId(), song.getId(), he.getId(), core.getId(), member.getId()))));
        as(admin, () -> taskService.publishStandardTask(admin, weekly.id()));

        TaskModels.TaskView data = as(admin, () -> taskService.createStandardTask(admin, new TaskModels.CreateTaskRequest(
                "整理无人机飞行实验数据", "<p>把 9 月三次户外飞行的日志整理成统一格式，上传到项目文档。</p>",
                today.minusDays(6), today.plusDays(4), 15,
                List.of(new TaskModels.SubtaskInput(null, "导出飞控日志", "<p>PX4 ulog 转 csv。</p>"),
                        new TaskModels.SubtaskInput(null, "标注异常片段", "<p>标出丢星与姿态突变的时间段。</p>")),
                List.of(), List.of(teacher.getId(), zhou.getId(), xu.getId(), core.getId()))));
        as(admin, () -> taskService.publishStandardTask(admin, data.id()));

        TaskModels.TaskView docs = as(admin, () -> taskService.createStandardTask(admin, new TaskModels.CreateTaskRequest(
                "为扩展板写一页使用说明", "<p>说明接口定义、上电顺序和常见故障。</p>", today.minusDays(1), today.plusDays(20), 10,
                List.of(), List.of(), List.of(he.getId(), song.getId(), member.getId()))));
        as(admin, () -> taskService.publishStandardTask(admin, docs.id()));

        // 周以宁 has already handed in the data task, so the admin overview has something to review.
        Authentication zhouAuth = authenticate(zhou.getAccount());
        as(zhouAuth, () -> {
            TaskModels.MyTaskView mine = taskService.myTasks(zhouAuth).stream()
                    .filter(task -> task.title().equals("整理无人机飞行实验数据")).findFirst().orElseThrow();
            TaskModels.MyTaskDetailView detail = taskService.myTaskDetail(zhouAuth, mine.assignmentId());
            detail.subtasks().forEach(subtask -> taskService.submitMySubtask(zhouAuth, mine.assignmentId(), subtask.id(),
                    "<p>已完成，文件放在项目文档 /flight-logs 目录。</p>"));
            return taskService.submitMyTask(zhouAuth, mine.assignmentId(), "三次飞行日志已整理并标注，异常片段共 7 处。");
        });
    }

    // ---------- bounties ----------

    private void createBounties(Authentication admin, MemberProfileEntity zhou, MemberProfileEntity chen,
                                MemberProfileEntity xu, MemberProfileEntity song, MemberProfileEntity he, LocalDate today) {
        if (taskExists("给 Go2 机器狗写避障演示脚本")) return;
        UUID go2 = bounty(admin, "给 Go2 机器狗写避障演示脚本",
                "<p>在实验室走廊场景跑通避障，录一段 1 分钟演示视频，代码合并到 demo 仓库。</p>",
                "奖金 ¥800，线下发放", 1, 30, null, today.minusDays(3), today.plusDays(24));
        UUID bank = bounty(admin, "整理 2026 届面试题库", "<p>按方向整理 40 道面试题，附参考答案与评分要点。</p>",
                "奖金 ¥300 / 人", 2, 20, 5, today.minusDays(5), today.plusDays(13));
        bounty(admin, "官网 Lighthouse 跑分提到 90", "<p>移动端性能分从 72 提升到 90 以上，提交前后报告截图。</p>",
                "奖金 ¥200", 1, 10, 3, today.minusDays(1), today.plusDays(8));

        claim(zhou, go2, null);
        claim(chen, go2, null);
        claim(xu, bank, null);
        claim(he, bank, null);
        claim(song, bank, "40 道题已按视觉、控制、嵌入式三个方向整理，附评分要点。");
    }

    private UUID bounty(Authentication admin, String title, String html, String prize, int slots, int points,
                        Integer headcount, LocalDate start, LocalDate end) {
        TaskModels.TaskView created = as(admin, () -> bountyService.create(admin, new TaskModels.CreateBountyRequest(
                title, html, prize, slots, points, headcount, start, end, List.of(), List.of())));
        as(admin, () -> bountyService.publish(created.id()));
        return created.id();
    }

    private void claim(MemberProfileEntity profile, UUID taskId, String completionNote) {
        Authentication auth = authenticate(profile.getAccount());
        as(auth, () -> {
            TaskModels.BountyClaimResult result = bountyService.claim(auth, taskId);
            if (completionNote != null) taskService.submitMyTask(auth, result.assignmentId(), completionNote);
            return result;
        });
    }

    // ---------- helpers ----------

    /** Each area is independent: one failing (for example a rule tightened later) must not block the rest. */
    private static void step(String name, Runnable action) {
        try {
            action.run();
        } catch (RuntimeException exception) {
            log.warn("Example content step '{}' skipped: {}", name, exception.getMessage());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private boolean taskExists(String title) {
        return tasks.findAll().stream().anyMatch(task -> task.getTitle().equals(title));
    }

    /** Loads a bootstrap profile with its account ready for use outside the loading transaction. */
    private MemberProfileEntity loadProfile(String memberCode) {
        return transactions.execute(status -> profiles.findByMemberCodeIgnoreCase(memberCode).map(profile -> {
            Hibernate.initialize(profile.getAccount());
            return profile;
        }).orElse(null));
    }

    private static UUID key(String name) {
        return UUID.nameUUIDFromBytes(("openlims-demo:" + name).getBytes(StandardCharsets.UTF_8));
    }

    private static Authentication authenticate(AccountEntity account) {
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_" + account.getRole().name()));
        account.getRole().permissions().forEach(permission -> authorities.add(new SimpleGrantedAuthority(permission.name())));
        return new UsernamePasswordAuthenticationToken(account.getId().toString(), null, authorities);
    }

    private static <T> T as(Authentication authentication, Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
