<script setup>
import { brand } from '../config/site'
import ThemeToggle from './ThemeToggle.vue'
import NotificationCenter from './NotificationCenter.vue'
import {
  BadgePlus,
  ClipboardCheck,
  Gift,
  ClipboardList,
  FolderKanban,
  Home,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  LogOut,
  Medal,
  MessageSquareText,
  Newspaper,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
  Wallet,
} from '@lucide/vue'
import { computed, inject, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDismissibleLayer } from '../composables/useDismissibleLayer'
import { authState, logout } from '../services/authApi'

const props = defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})

// Inside AdminLayout the sidebar and top bar persist across admin routes;
// this component then only renders the page heading and content.
const adminLayout = inject('adminLayout', null)
watchEffect(() => {
  if (adminLayout) adminLayout.title = props.title
})

const router = useRouter()
const route = useRoute()
const roleLabels = {
  TEACHER: '教师 · 系统管理员',
  CORE_STUDENT: '核心学生 · 系统管理员',
  MEMBER: '正式成员',
  VISITOR: '报名访客',
}
const accountLabel = computed(() => roleLabels[authState.account?.role] || authState.account?.role)
const accountName = computed(() => authState.account?.displayName || authState.account?.username || '')
const adminSectionActive = computed(() => route.path.startsWith('/admin/'))
const adminMenu = ref(null)

function closeAdminMenu() {
  if (adminMenu.value) adminMenu.value.open = false
}

useDismissibleLayer(adminMenu, {
  isOpen: () => Boolean(adminMenu.value?.open),
  close: closeAdminMenu,
  focusTarget: () => adminMenu.value?.querySelector('summary'),
})

watch(
  () => route.fullPath,
  () => closeAdminMenu(),
)

async function signOut() {
  await logout()
  router.push('/')
}
</script>

<template>
  <main v-if="adminLayout" class="portal-main">
    <header class="portal-heading" :class="{ 'has-actions': $slots.actions }">
      <p>{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <span>{{ description }}</span>
      <div v-if="$slots.actions" class="portal-heading-actions"><slot name="actions" /></div>
    </header>
    <slot />
  </main>
  <div v-else class="portal-page">
    <header class="portal-topbar">
      <RouterLink class="portal-brand" to="/" :aria-label="`返回 ${brand.name} 公开首页`">
        <img :src="brand.logo" :alt="brand.name" width="900" height="300" />
        <span>MEMBER SYSTEM</span>
      </RouterLink>
      <nav aria-label="成员系统导航">
        <RouterLink to="/"><Home :size="17" aria-hidden="true" />公开首页</RouterLink>
        <RouterLink v-if="authState.account && authState.account.role !== 'VISITOR'" to="/profile"
          ><UserRound :size="17" aria-hidden="true" />个人主页</RouterLink
        >
        <RouterLink v-if="authState.account && authState.account.role !== 'VISITOR'" to="/points"
          ><Trophy :size="17" aria-hidden="true" />积分榜</RouterLink
        >
        <RouterLink v-if="authState.account && authState.account.role !== 'VISITOR'" to="/fund"
          ><Wallet :size="17" aria-hidden="true" />实验室基金</RouterLink
        >
        <RouterLink v-if="authState.account && authState.account.role !== 'VISITOR'" to="/projects"
          ><FolderKanban :size="17" aria-hidden="true" />项目团队</RouterLink
        >
        <RouterLink v-if="authState.account && authState.account.role !== 'VISITOR'" to="/tasks"
          ><ListChecks :size="17" aria-hidden="true" />我的任务</RouterLink
        >
        <RouterLink v-if="authState.account && authState.account.role !== 'VISITOR'" to="/bounties"
          ><Gift :size="17" aria-hidden="true" />悬赏</RouterLink
        >
        <RouterLink v-if="authState.account && authState.account.role !== 'VISITOR'" to="/competitions"
          ><Medal :size="17" aria-hidden="true" />比赛管理</RouterLink
        >
        <RouterLink to="/discussions"><MessageSquareText :size="17" aria-hidden="true" />讨论板</RouterLink>
        <RouterLink v-if="authState.account?.role === 'VISITOR'" to="/application"
          ><ClipboardList :size="17" aria-hidden="true" />我的报名</RouterLink
        >
        <details
          v-if="authState.account?.systemAdmin"
          ref="adminMenu"
          class="portal-admin-menu"
          @click="(event) => event.target.closest('a') && closeAdminMenu()"
        >
          <summary :class="{ active: adminSectionActive }">
            <LayoutDashboard :size="17" aria-hidden="true" />后台管理
          </summary>
          <div>
            <RouterLink to="/admin/members"><UsersRound :size="17" aria-hidden="true" />成员管理</RouterLink>
            <RouterLink to="/admin/points"><BadgePlus :size="17" aria-hidden="true" />积分管理</RouterLink>
            <RouterLink to="/admin/recruitment"><ShieldCheck :size="17" aria-hidden="true" />招新管理</RouterLink>
            <RouterLink to="/admin/tasks"><ClipboardCheck :size="17" aria-hidden="true" />任务管理</RouterLink>
            <RouterLink to="/admin/bounties"><Gift :size="17" aria-hidden="true" />悬赏管理</RouterLink>
            <RouterLink to="/admin/achievements"><Newspaper :size="17" aria-hidden="true" />成果管理</RouterLink>
            <RouterLink to="/admin/homepage"><LayoutTemplate :size="17" aria-hidden="true" />主页编辑</RouterLink>
          </div>
        </details>
      </nav>
      <div class="portal-account">
        <ThemeToggle /><NotificationCenter v-if="authState.account" />
        <div v-if="!authState.account" class="portal-guest-actions">
          <RouterLink to="/login">登录</RouterLink><RouterLink class="register" to="/register">注册</RouterLink>
        </div>
        <RouterLink
          v-if="authState.account && authState.account.role !== 'VISITOR'"
          class="portal-account-avatar"
          to="/profile"
          aria-label="打开个人主页"
        >
          <img v-if="authState.account?.avatarUrl" :src="authState.account.avatarUrl" alt="" />
          <b v-else>{{ accountName.slice(0, 1) }}</b>
        </RouterLink>
        <span v-if="authState.account"
          ><strong>{{ accountName }}</strong
          ><small>{{ accountLabel }}</small></span
        >
        <button v-if="authState.account" type="button" aria-label="退出登录" @click="signOut">
          <LogOut :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <main class="portal-main">
      <header class="portal-heading">
        <p>{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <span>{{ description }}</span>
      </header>
      <slot />
    </main>
  </div>
</template>
