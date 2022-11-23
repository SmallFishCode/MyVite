# MyVite

## 1. Vite 的特点

1. 闪电般的冷启动速度
2. 即使热模块更换（HMR）
3. 真正的按需编译

## 2. Vite 的要求

1. Vite 要求项目完全由 ES Module 模块组成
2. common.js 模块不能直接在 Vite 上使用
3. 打包上依旧还是使用 rollup 等传统打包工具

## 3. 开发 Vite 解决的问题

1. 第三方库的引入问题
2. 对 CSS 资源的支持
3. .Vue 单文件的支持
4. 对 TS 的支持

## 4. 手写 Vite 第一部分（基础功能）

1. 前端起一个静态网站， 后端用 Koa 起一个服务

```js
在根目录下
npm i koa -S
mkdir index.js
```

2. 引入 Koa，并起一个服务，监听 3000 端口

```js
const Koa = require('koa')
const app = new Koa()
const fs = require('fs')
const path = require('path')

app.use(async (ctx) => {
	const { url, query } = ctx.request
	console.log('url:' + url)
	//  / => index.html
	if (url === '/') {
		ctx.type = 'text/html'
		// 读取入口文件
		const content = fs.readFileSync('./index.html', 'utf-8')
		ctx.body = content
	}
	// *.js => src/*.js
})

app.listen('3000', () => {
	console.log('服务已启动在 3000 端口~')
})
```

当用户访问 3000 端口时，服务通过 `ctx.request` 获取到该文件根目录下的入口文件：`index.html`, 如何提供给用户？

-   判断 url === '/', 如果是的话，通过 node 自带的文件系统模块 `fs` 读取到当前目录下 index.html 文件的内容并通过 `ctx.body` 发送给用户

-   我们将 main.js 中的 script 标签加上 `type="module"` 属性，这样浏览器将按照 ES Module 的方式去请求文件，所以这个时候，浏览器会去请求 `./src/main.js`, 那我们又如何提供 js 文件给用户呢？

```js
app.use(async (ctx) => {
	const { url, query } = ctx.request
	console.log('url:' + url)
	//  / => index.html
	if (url === '/') {
		ctx.type = 'text/html'
		// 读取入口文件
		const content = fs.readFileSync('./index.html', 'utf-8')
		ctx.body = content
	}
	// *.js => src/*.js
	else if (url.endsWith('.js')) {
		// /src/main.js => 代码文件所在位置/src/main.js
		// 去掉 '/'
		const p = path.resolve(__dirname, url.slice(1))
		const content = fs.readFileSync(p, 'utf-8')
		ctx.type = 'application/javascript'
		ctx.body = content
	}
})
```

-   可以看到，我们判断当前请求的 url 是以 `.js` 结尾的文件，这时，我们使用 node 自带的路径模块 `path` 去读取当前根目录所在路径，并拼接上访问的路径。

-   最后，通过 `ctx.body` 将 fs 获取到的 js 文件内容返回给用户。

至此，已经能够支持基本的功能了，让我们接着完善它的功能~

## 5. 支持第三方库 (此处用 Vue 示例)

```js
npm i vue@next -S
```

我们在 main.js 中使用 vue

```js
import { createApp, h } from 'vue'

const App = {
	render() {
		// <div><div>Hello, Vite!</div></div>
		return h('div', null, [h('div', null, String('Hello, Vite!'))])
	},
}

createApp(App).mount('#app')
```

可以发现浏览器是会报错的，因为 from 的路径不合法，不是以 '.' 或者 '/' 开头，所以该如何解决？

-   我们知道，在项目中引入第三方库，它会指向安装到本地的 node_modules 当中对应模块的代码，所以我们需要将 form 后面的路径转换一下，欺骗一下浏览器，让它变成合法的路径。

```js
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
```

-   我们将 'vue' 通过 `正则` 转换为了 '/@modules/vue'，所以现在浏览器不会报错，然后我们继续往下，让它指向 node_modules 下面的 vue 模块。

-   我们在前面的基础上，加上一个 else if 分支，判断是否是以 '/@modules' 开始的 url，如果是的话，则通过下面这几步，引入到 node_modules 对应的模块下：
    1. 获取到 node_modules 下 vue 模块的路径，通过 `path.resolve()`
    2. 通过 `require()` 获取到 vue 模块下的 package.json 的 module 属性
    3. 获取到 module 指向路径的绝对路径之后通过 `fs` 读取文件，返回给用户
    4. 这个时候我们去浏览器看看，可以正常获取到 vue 的相关文件，但是控制台报错 `缺少 process` 我们知道这是 node 环境的环境变量，所以我们需要在 最前面引入一个 script， 并自己定义一个 process 给它使用，所以我们需要在获取根目录文件的时候， 在 content 后面加上 一串代码，如下所示。

```js
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
```

到此，我们已经完成了对第三方库的支持！！

## 6. Vue 单文件组件支持

1. 首先我们需要安装一下 vue 用来解析 template 模板的库

```js
npm i @vue/compiler-sfc -s
```

然后新件一个 vue 文件，引入到 main.js 中

```js
import { createApp, h } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

2. 我们新增一个 else if 判断获取的 url 是否为 vue 文件，
   然后分两步，第一步提取出 vue 文件的 script 部分，第二步提取出 template 并转换为 render 函数返回

3. 通过 path 获取到 App.vue 的路径，读取其中的内容，并用 `compilerSfc.parse(fs.readFileSync(p, 'utf-8'))` 获取到编译后的对象， 里面包含 script 和 template 的代码。

4. 判断请求有没有携带上 `type=template` 的参数，如果没有，则走第一个分支：

    - 借用 vue 自带的 compile 框架， 解析单文件组件， 其实相当于 vue-loader 做的事情。

    - vue 分两步，再去加载 type=template 文件。

    - 可以看到返回的是一个模板字符串，拿到之后，又会朝后端获取一个 template 文件，参数携带了 type，这个时候会走另一条。

5. 第二条分支， 将 template 模板通过 `compilerDom.compile(template.content, { mode: 'module' })` 转换为 render 函数并返回给用户。

```js
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
```

至此，页面上已经展示成功！！能够支持单文件组件！

## 7. 支持 CSS 文件

1. 在 src 下新增 index.css

```css
h1 {
	color: red;
}
h2 {
	color: blue;
}
```

2. 新增 else if 分支，判断当前请求文件为 css 文件，获取到该路径，然后用 fs 读取文件。

3. 使用 content 变量，用模板字符串实现，创建 style 标签， 添加 type 属性， 挂载到 head 下，将 css 的内容赋值给 innerHTML，最后通过 ctx.body 返回

```js
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
```

至此，简易版 Vite 已经完成！！！
