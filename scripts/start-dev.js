import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const viteCli = new URL('../node_modules/vite/bin/vite.js', import.meta.url)
process.chdir(projectRoot)

let revision = '源码压缩包（没有 Git 版本信息）'
try {
  revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
} catch {
  // Downloaded source archives can run without Git.
}

console.log(`\nOpenLIMS 前端 · 当前提交 ${revision}`)
console.log(`源码目录：${projectRoot}`)
console.log('此命令只运行本机源码；更新仓库请先执行 git pull --ff-only 和 npm ci。')
console.log('请打开下方 Local 显示的地址；端口已被占用时会停止，不会自动换端口。\n')

if (!existsSync(viteCli)) {
  console.error('缺少前端依赖，请先在上述目录执行 npm ci。')
  process.exitCode = 1
} else {
  await import(viteCli.href)
}
