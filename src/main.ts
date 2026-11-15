import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';
import { installPluginTheme } from './theme';

// 插件 webview 不加载宿主样式表：亮/暗与强调色由插件自己引导，
// 令牌定义见 styles.css（不依赖 Element Plus 的 css-vars）。
installPluginTheme();

createApp(App).mount('#app');
