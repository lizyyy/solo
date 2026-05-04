<template>
  <div class="d-flex flex-column min-vh-100">
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
      <div class="container-fluid">
        <router-link class="navbar-brand" to="/">
          <i class="bi bi-box-seam me-2"></i>
          冷链团购管理系统
        </router-link>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav">
            <li class="nav-item">
              <router-link class="nav-link" to="/">仪表盘</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/products">商品管理</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/group-batches">团购批次</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/orders">订单管理</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/inventory">库存管理</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/freezers">冰柜管理</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/pickup-slots">自提时段</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/exceptions">异常处理</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/export">报表导出</router-link>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <main class="flex-grow-1 py-4 bg-light">
      <div class="container-fluid">
        <router-view />
      </div>
    </main>

    <footer class="bg-dark text-light py-3 mt-auto">
      <div class="container text-center">
        <small>社区冷链团购自提管理系统 &copy; 2026</small>
      </div>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
.navbar-brand {
  font-weight: bold;
}

.nav-link {
  transition: opacity 0.2s;
}

.nav-link:hover {
  opacity: 0.8;
}
</style>
