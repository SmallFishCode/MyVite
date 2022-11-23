import { createApp, h } from 'vue'

const App = {
	render() {
		// <div><div>Hello, Vite!</div></div>
		return h('div', null, [h('div', null, String('Hello, Vite!'))])
	},
}

createApp(App).mount('#app')
