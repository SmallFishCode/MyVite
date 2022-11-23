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
	else if (url.endsWith('.js')) {
		// /src/main.js => 代码文件所在位置/src/main.js
		// 去掉 '/'
		const p = path.resolve(__dirname, url.slice(1))
		const content = fs.readFileSync(p, 'utf-8')
		ctx.type = 'application/javascript'
		ctx.body = content
	}
})

app.listen('3000', () => {
	console.log('服务已启动在 3000 端口~')
})
