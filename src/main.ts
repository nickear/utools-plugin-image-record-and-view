import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'
import 'virtual:svg-icons-register'

createApp(App).use(ElementPlus).mount('#app')
