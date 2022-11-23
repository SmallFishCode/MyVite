const Koa = require('koa')
const app = new Koa()
const fs = require('fs')
const path = require('path')
const compilerSfc = require('@vue/compiler-sfc')
const compilerDom = require('@vue/compiler-dom')

app.use(async (ctx) => {
	const { url, query } = ctx.request
	console.log('url:' + url)
	//  / => index.html
	if (url === '/') {
		ctx.type = 'text/html'
		// 读取入口文件
		let content = fs.readFileSync('./index.html', 'utf-8')
		// 入口文件，加入环境变量
		content = content.replace(
			'<script',
			`
		<script>
			window.process = {env: {NODE_ENV: 'dev'}}
		</script>
		<script`
		)
		ctx.body = content
	}
	// *.js => src/*.js
	else if (url.endsWith('.js')) {
		// /src/main.js => 代码文件所在位置/src/main.js
		// 去掉 '/'
		const p = path.resolve(__dirname, url.slice(1))
		const content = fs.readFileSync(p, 'utf-8')
		ctx.type = 'application/javascript'
		ctx.body = rewriteImport(content)
	}
	// 第三方库的支持
	// /@modules/vue => node_modules
	else if (url.startsWith('/@modules')) {
		// /@modules/vue => 代码的位置/node_modules/vue 的 module 属性入口
		// 引入到 node_modules/vue/ 的 es 模块入口
		// 根据 vue 模块的 package.json 判断入口文件 module 属性
		const prefix = path.resolve(__dirname, 'node_modules', url.replace('/@modules/', ''))

		// 加载 vue 模块下的 package.json 文件的 module 属性
		const module = require(prefix + '/package.json').module

		// dist/vue.runtime.esm-bundler.js
		const p = path.resolve(prefix, module)
		const ret = fs.readFileSync(p, 'utf-8')
		ctx.type = 'application/javascript'
		ctx.body = rewriteImport(ret)
	}

	// 支持单文件组件 SFC 组件
	// *.vue =>
	else if (url.indexOf('.vue') !== -1) {
		// 第一步： vue 文件 => template script
		const p = path.resolve(__dirname, url.split('?')[0].slice(1)) // 得到 app.vue 的目录
		const ret = compilerSfc.parse(fs.readFileSync(p, 'utf-8'))
		console.log('ret:' + ret)
		const { descriptor } = ret

		if (!query.type) {
			// ret.descriptor.script 提取 js 部分 + (template模板生成) render 函数
			ctx.type = 'application/javascript'
			// 借用 vue 自带的 compile 框架， 解析单文件组件， 其实相当于 vue-loader 做的事情
			// vue 分两步，再去加载 type=template 文件
			ctx.body = `${rewriteImport(descriptor.script.content.replace('export default ', 'const __script = '))}
			import { render as __render} from "${url}?type=template"
			__script.render = __render
			export default __script
			`
		} else {
			// 第二步：template 模板 => render函数
			const template = descriptor.template
			const render = compilerDom.compile(template.content, { mode: 'module' })
			ctx.type = 'application/javascript'
			console.log('render:' + render)
			ctx.body = rewriteImport(render.code)
		}
	}
	// 解析 CSS
	else if (url.endsWith('.css')) {
		const p = path.resolve(__dirname, url.slice(1))
		const file = fs.readFileSync(p, 'utf-8')
		// css 转换为 js 代码
		// 利用 JS 添加一个 style 标签
		const content = `
		const css = "${file.replace(/\s/g, '')}"
		let link = document.createElement('style')
		link.setAttribute('type', 'text/css')
		document.head.appendChild(link)
		link.innerHTML = css
		export default css
		`

		ctx.type = 'application/javascript'
		ctx.body = content
	}

	// vue => node_modules/**
	// 改写函数
	// 需要改写，欺骗一下浏览器 'vue' => '/@modules' => 别名 (为了让前端认为是合法的路径)
	// from 'xxx'
	function rewriteImport(content) {
		// 正则
		return content.replace(/ from ['|"]([^'"]+)['|"]/g, (s0, s1) => {
			// 判断不是一个绝对路径或相对路径
			if (s1[0] !== '.' && s1[1] !== '/') {
				return ` from '/@modules/${s1}'`
			} else {
				return s0
			}
		})
	}
})

app.listen('3000', () => {
	console.log('服务已启动在 3000 端口~')
})
