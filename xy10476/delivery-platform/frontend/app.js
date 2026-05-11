const createApp = Vue.createApp;

const App = {
  components: {
    DashboardView,
    KanbanView,
    BuildingsView,
    ProblemsView,
    ContractorsView
  },
  template: `
    <el-container class="app-container">
      <el-header class="app-header">
        <div class="logo">
          <el-icon><House /></el-icon>
          <span>新房交付整改台</span>
        </div>
        <el-menu 
          :default-active="activeMenu" 
          mode="horizontal" 
          @select="handleMenuSelect"
          class="header-menu"
        >
          <el-menu-item index="dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>总览看板</span>
          </el-menu-item>
          <el-menu-item index="kanban">
            <el-icon><Grid /></el-icon>
            <span>整改看板</span>
          </el-menu-item>
          <el-menu-item index="buildings">
            <el-icon><OfficeBuilding /></el-icon>
            <span>楼栋房号</span>
          </el-menu-item>
          <el-menu-item index="problems">
            <el-icon><Warning /></el-icon>
            <span>验房问题</span>
          </el-menu-item>
          <el-menu-item index="contractors">
            <el-icon><User /></el-icon>
            <span>施工方管理</span>
          </el-menu-item>
        </el-menu>
      </el-header>
      
      <el-main class="app-main">
        <template v-if="activeMenu === 'dashboard'"><dashboard-view></dashboard-view></template>
        <template v-else-if="activeMenu === 'kanban'"><kanban-view></kanban-view></template>
        <template v-else-if="activeMenu === 'buildings'"><buildings-view></buildings-view></template>
        <template v-else-if="activeMenu === 'problems'"><problems-view></problems-view></template>
        <template v-else-if="activeMenu === 'contractors'"><contractors-view></contractors-view></template>
      </el-main>
    </el-container>
  `,
  setup() {
    const activeMenu = Vue.ref('dashboard');
    
    const handleMenuSelect = (index) => {
      activeMenu.value = index;
    };

    return {
      activeMenu,
      handleMenuSelect
    };
  }
};

const app = createApp(App);

const reservedHtmlTags = new Set([
  'filter', 'link', 'menu', 'picture', 'select', 'switch', 'view',
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
  'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button',
  'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
  'em', 'embed',
  'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html',
  'i', 'iframe', 'img', 'input', 'ins',
  'kbd',
  'label', 'legend', 'li', 'main', 'map', 'mark', 'meta', 'meter',
  'nav', 'noscript',
  'object', 'ol', 'optgroup', 'option', 'output',
  'p', 'param', 'pre', 'progress',
  'q',
  'rp', 'rt', 'ruby',
  's', 'samp', 'script', 'section', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track',
  'u', 'ul',
  'var', 'video',
  'wbr'
]);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
  const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  if (kebabKey !== key && !reservedHtmlTags.has(kebabKey)) {
    app.component(kebabKey, component);
  }
}

app.use(ElementPlus);
app.mount('#app');
