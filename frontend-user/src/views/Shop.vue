<template>
  <div class="shop-page">
    <header class="page-header">
      <div class="header-content">
        <span class="page-tag">正品保障</span>
        <h1>装备商城</h1>
        <p>精选台球装备，品质保证，助您提升球技</p>
      </div>
    </header>

    <div class="shop-layout">
      <aside class="sidebar">
        <h3 class="section-title">商品分类</h3>
        <div class="category-section">
          <div class="category-list">
            <button
              v-for="cat in categories"
              :key="cat.id"
              :class="{ active: selectedCategory === cat.id }"
              @click="selectedCategory = cat.id"
            >
              <span class="cat-icon">{{ cat.icon }}</span>
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-count">{{ getCategoryCount(cat.id) }}</span>
            </button>
          </div>
        </div>
      </aside>

      <main class="main-content">
        <div class="content-header">
          <div class="result-count">共 <span>{{ filteredProducts.length }}</span> 件商品</div>
          <select v-model="sortBy" class="sort-select">
            <option value="default">默认排序</option>
            <option value="price-asc">价格从低到高</option>
            <option value="price-desc">价格从高到低</option>
          </select>
        </div>

        <div class="products-grid">
          <div v-for="product in sortedProducts" :key="product.id" class="product-card" @click="openProductDetail(product)">
            <div class="product-image">
              <div class="image-placeholder">{{ product.icon }}</div>
              <div class="product-badges">
                <span v-if="product.hot" class="badge hot">热销</span>
                <span v-if="product.new" class="badge new">新品</span>
                <span v-if="product.stock <= 0" class="badge soldout">已售罄</span>
                <span v-else-if="product.stock <= 5" class="badge lowstock">仅剩{{ product.stock }}件</span>
              </div>
              <button
                v-if="product.stock > 0"
                class="quick-add"
                :title="'加入购物车'"
                @click.stop="quickAddToCart(product)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
            <div class="product-info">
              <span class="product-brand">{{ product.brand }}</span>
              <h3>{{ product.name }}</h3>
              <p class="product-desc">{{ product.description }}</p>
              <div class="product-footer">
                <div class="price-info">
                  <span class="current-price">¥{{ product.price }}</span>
                  <span v-if="product.originalPrice" class="original-price">¥{{ product.originalPrice }}</span>
                </div>
                <span class="sales">已售 {{ product.sales }} · 库存{{ product.stock }}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Cart Float -->
    <div v-if="cartItems.length > 0" class="cart-float" @click="showCartModal = true">
      <div class="cart-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <span class="cart-count">{{ cartCount }}</span>
      </div>
      <div class="cart-total">¥{{ cartQuote.totalAmount }}</div>
    </div>

    <!-- Product Detail Modal -->
    <Modal v-model="showDetailModal" size="large" :show-footer="false">
      <div v-if="selectedProduct" class="product-detail">
        <div class="detail-image">
          <div class="detail-icon">{{ selectedProduct.icon }}</div>
        </div>
        <div class="detail-info">
          <span class="detail-brand">{{ selectedProduct.brand }}</span>
          <h2>{{ selectedProduct.name }}</h2>
          <p class="detail-desc">{{ selectedProduct.description }}</p>
          <div class="detail-specs">
            <div class="spec-item"><span class="label">分类</span><span class="value">{{ getCategoryName(selectedProduct.category) }}</span></div>
            <div class="spec-item"><span class="label">销量</span><span class="value">{{ selectedProduct.sales }}件</span></div>
            <div class="spec-item"><span class="label">库存</span><span class="value" :class="{ 'stock-low': selectedProduct.stock <= 5 }">{{ selectedProduct.stock > 0 ? selectedProduct.stock + '件' : '已售罄' }}</span></div>
          </div>
          <div class="detail-price">
            <span class="current">¥{{ selectedProduct.price }}</span>
            <span v-if="selectedProduct.originalPrice" class="original">¥{{ selectedProduct.originalPrice }}</span>
          </div>
          <div class="quantity-selector">
            <span class="qty-label">数量</span>
            <div class="qty-controls">
              <button :disabled="quantity <= 1" @click="changeDetailQuantity(-1)">-</button>
              <span>{{ quantity }}</span>
              <button :disabled="quantity >= detailMaxQty" @click="changeDetailQuantity(1)">+</button>
            </div>
            <span v-if="selectedProduct.stock <= 5 && selectedProduct.stock > 0" class="qty-hint">最多购买{{ selectedProduct.stock }}件</span>
            <span v-else-if="selectedProduct.stock <= 0" class="qty-hint danger">该商品已售罄</span>
          </div>
          <div class="detail-actions">
            <button class="btn-add-cart" :disabled="selectedProduct.stock <= 0" @click="addToCartFromDetail">加入购物车</button>
            <button class="btn-buy-now" :disabled="selectedProduct.stock <= 0" @click="buyNow">立即购买</button>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Cart Modal -->
    <Modal v-model="showCartModal" title="购物车" size="medium" :show-footer="false">
      <div class="cart-content">
        <div v-if="cartItems.length > 0" class="cart-items">
          <div v-for="item in cartItems" :key="item.id" class="cart-item">
            <div class="item-icon">{{ item.icon }}</div>
            <div class="item-info">
              <h4>{{ item.name }}</h4>
              <span class="item-brand">{{ item.brand }} · ¥{{ item.price }}/件 · 库存{{ item.stock }}</span>
            </div>
            <div class="cart-qty-controls">
              <button :disabled="item.qty <= 1" @click="changeCartQty(item, -1)">-</button>
              <span>{{ item.qty }}</span>
              <button :disabled="item.qty >= item.stock" @click="changeCartQty(item, 1)">+</button>
            </div>
            <div class="item-price">¥{{ item.price * item.qty }}</div>
            <button class="remove-btn" @click="removeFromCart(item)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div v-else class="cart-empty"><div class="empty-icon">🛒</div><p>购物车是空的</p></div>
        <div v-if="cartItems.length > 0" class="cart-footer">
          <div class="cart-summary">
            <span>共 {{ cartCount }} 件商品</span>
            <span class="total">合计：<strong>¥{{ cartQuote.totalAmount }}</strong></span>
          </div>
          <button class="btn-checkout" @click="checkout">去结算</button>
        </div>
      </div>
    </Modal>

    <!-- Checkout / Resume Payment Modal -->
    <Modal
      v-model="showCheckoutModal"
      icon="🛒"
      icon-type="info"
      :title="checkoutView.resumeOrderNo ? '继续付款' : '确认订单'"
      size="medium"
      :confirm-text="checkoutView.acceptNewAmount ? `按新金额支付 ¥${checkoutView.quote.totalAmount}` : '确认支付'"
      :cancel-text="checkoutView.resumeOrderNo ? '返回商城' : '取消'"
      :loading="checkoutLoading"
      :close-on-overlay="!checkoutLoading"
      @confirm="confirmCheckout"
      @cancel="onCheckoutCancel"
    >
      <div class="checkout-info">
        <div v-if="checkoutView.resumeOrderNo" class="info-row">
          <span class="label">订单编号</span>
          <span class="value mono">{{ checkoutView.resumeOrderNo }}</span>
        </div>
        <div class="checkout-items">
          <div v-for="line in checkoutView.quote.lines" :key="line.id" class="checkout-item">
            <span class="ci-icon">{{ line.icon }}</span>
            <span class="ci-name">{{ line.name }}</span>
            <span class="ci-qty">x{{ line.qty }}</span>
            <span class="ci-price">¥{{ line.amount }}</span>
          </div>
        </div>
        <div class="info-row">
          <span class="label">商品数量</span>
          <span class="value">{{ checkoutView.quote.totalQty }} 件</span>
        </div>

        <!-- 金额变化提示 -->
        <div v-if="checkoutView.priceChanged" class="checkout-alert warning">
          <span class="alert-icon">⚠️</span>
          <div class="alert-body">
            <p>商品金额已变化</p>
            <p class="alert-detail">
              下单时 ¥{{ checkoutView.snapshotAmount }}，当前应付
              <strong>¥{{ checkoutView.quote.totalAmount }}</strong>
            </p>
            <label class="alert-confirm">
              <input v-model="checkoutView.acceptNewAmount" type="checkbox" />
              我已确认，按新金额 ¥{{ checkoutView.quote.totalAmount }} 支付
            </label>
          </div>
        </div>

        <!-- 库存不足提示 -->
        <div v-if="checkoutView.stockError" class="checkout-alert error">
          <span class="alert-icon">📦</span>
          <div class="alert-body">
            <p>库存不足</p>
            <p class="alert-detail">{{ checkoutView.stockError }}</p>
            <button class="btn-inline-fix" @click="adjustToStock">按库存调整数量</button>
          </div>
        </div>

        <div class="info-row total">
          <span class="label">应付金额</span>
          <span class="value price">¥{{ checkoutView.quote.totalAmount }}</span>
        </div>
        <p class="checkout-tip">支付时将再次校验库存与金额；支付中断后可在任务中心继续付款，不会重复下单。</p>
      </div>
    </Modal>

    <!-- Success Modal -->
    <Modal v-model="showSuccessModal" icon="🎉" icon-type="success" title="支付成功" subtitle="您的订单已提交" size="small" :show-cancel="false" confirm-text="查看订单" @confirm="viewOrderDetail">
      <div v-if="orderResult" class="success-info">
        <div class="info-row"><span class="label">订单编号</span><span class="value mono">{{ orderResult.orderNo }}</span></div>
        <div class="info-row"><span class="label">商品数量</span><span class="value">{{ orderResult.totalQty }} 件</span></div>
        <div class="info-row"><span class="label">支付金额</span><span class="value">¥{{ orderResult.amount }}</span></div>
      </div>
    </Modal>

    <!-- Orders Modal -->
    <Modal v-model="showOrdersModal" title="我的订单" size="medium" :show-footer="false">
      <div class="orders-content">
        <div v-if="orders.length > 0" class="orders-list">
          <div v-for="order in orders" :key="order.id" class="order-card">
            <div class="order-header">
              <span class="order-no">{{ order.extra.orderNo }}</span>
              <span class="order-status" :class="order.status">{{ orderStatusText[order.status] || order.status }}</span>
            </div>
            <div class="order-items">
              <div v-for="item in order.extra.items" :key="item.id" class="order-item">
                <span class="item-icon">{{ item.icon }}</span>
                <span class="item-name">{{ item.name }}</span>
                <span class="item-qty">x{{ item.qty }}</span>
              </div>
            </div>
            <div class="order-footer">
              <span class="order-time">{{ order.extra.createTime || order.createdAt }}</span>
              <span class="order-amount">¥{{ order.amount }}</span>
            </div>
            <div class="order-actions">
              <button v-if="order.status === 'pending_payment'" class="order-btn primary" @click="resumeOrder(order)">继续付款</button>
              <button v-if="order.status === 'pending_payment'" class="order-btn danger" @click="cancelOrder(order)">取消订单</button>
              <button v-if="order.status === 'pending_shipment'" class="order-btn default" @click="remindShipment(order)">提醒发货</button>
              <button v-if="order.status === 'shipped'" class="order-btn primary" @click="confirmReceipt(order)">确认收货</button>
              <button v-if="order.status === 'completed'" class="order-btn default" @click="rebuyOrder(order)">再次购买</button>
            </div>
          </div>
        </div>
        <div v-else class="orders-empty">
          <div class="empty-icon">📦</div>
          <p>暂无订单</p>
        </div>
      </div>
    </Modal>

    <!-- Cancel Order Confirm Modal -->
    <Modal
      v-model="showCancelOrderModal"
      icon="warning"
      icon-type="warning"
      title="取消订单"
      subtitle="确定要取消此订单吗？取消后不会重复生成订单。"
      size="small"
      confirm-text="确认取消"
      confirm-type="danger"
      :loading="cancelOrderLoading"
      @confirm="confirmCancelOrder"
    />

    <Toast v-model="showToast" :type="toastType" :title="toastTitle" :message="toastMessage" />

    <LoginModal v-model="showLoginModal" @login-success="onLoginSuccess" />
  </div>
</template>

<script>
import Modal from '../components/Modal.vue'
import Toast from '../components/Toast.vue'
import LoginModal from '../components/LoginModal.vue'
import { isAuthenticated } from '../utils/auth'
import { taskStore } from '../utils/taskStore'
import { shopStore, ShopError } from '../utils/shopStore'

export default {
  name: 'Shop',
  components: { Modal, Toast, LoginModal },
  data() {
    return {
      selectedCategory: 'all',
      sortBy: 'default',
      // 商品目录（含库存 / 销量），shopStore 为唯一数据源
      products: [],
      cartItems: [],
      showDetailModal: false,
      showCartModal: false,
      showCheckoutModal: false,
      showSuccessModal: false,
      showOrdersModal: false,
      showCancelOrderModal: false,
      checkoutLoading: false,
      cancelOrderLoading: false,
      selectedProduct: null,
      quantity: 1,
      orderResult: null,
      orders: [],
      // 结算视图：购物车结算或待付款订单继续付款共用
      checkoutView: this.emptyCheckoutView(),
      cancelTargetOrder: null,
      showToast: false,
      toastType: 'success',
      toastTitle: '',
      toastMessage: '',
      showLoginModal: false,
      pendingAction: null,
      pendingProduct: null,
      pendingQty: 1,
      categories: [
        { id: 'all', name: '全部商品', icon: '🏷️' },
        { id: 'cue', name: '球杆', icon: '🏏' },
        { id: 'ball', name: '台球', icon: '🎱' },
        { id: 'accessory', name: '配件', icon: '🔧' },
        { id: 'clothing', name: '服装', icon: '👔' }
      ],
      orderStatusText: {
        pending_payment: '待付款',
        pending_shipment: '待发货',
        shipped: '已发货',
        completed: '已完成',
        cancelled: '已取消'
      }
    }
  },
  computed: {
    filteredProducts() {
      if (this.selectedCategory === 'all') return this.products
      return this.products.filter(p => p.category === this.selectedCategory)
    },
    sortedProducts() {
      const result = [...this.filteredProducts]
      if (this.sortBy === 'price-asc') result.sort((a, b) => a.price - b.price)
      else if (this.sortBy === 'price-desc') result.sort((a, b) => b.price - a.price)
      return result
    },
    cartQuote() {
      const lines = this.cartItems
      const totalAmount = lines.reduce((sum, item) => sum + item.price * item.qty, 0)
      const totalQty = lines.reduce((sum, item) => sum + item.qty, 0)
      return { totalAmount, totalQty }
    },
    cartCount() {
      return this.cartQuote.totalQty
    },
    detailMaxQty() {
      if (!this.selectedProduct) return 1
      return Math.max(1, this.selectedProduct.stock)
    }
  },
  watch: {
    '$route.query.orderNo': {
      handler() {
        if (this.$route.path === '/shop') this.handleRouteQuery()
      }
    }
  },
  mounted() {
    this.refreshFromStore()
    // 任务中心支付 / 取消、其它标签页改动后同步库存与购物车
    this._unsubscribe = shopStore.subscribe(() => this.refreshFromStore())
    window.addEventListener('focus', this.refreshFromStore)
    this.handleRouteQuery()
  },
  beforeUnmount() {
    if (this._unsubscribe) this._unsubscribe()
    window.removeEventListener('focus', this.refreshFromStore)
  },
  activated() {
    this.refreshFromStore()
  },
  methods: {
    emptyCheckoutView() {
      return {
        lines: [],
        quote: { lines: [], totalAmount: 0, totalQty: 0 },
        snapshotAmount: 0,
        priceChanged: false,
        acceptNewAmount: false,
        stockError: '',
        resumeOrderNo: '',
        // 继续付款时订单内条目（id/qty），购物车结算时取购物车
        sourceLines: []
      }
    },

    refreshFromStore() {
      this.products = shopStore.getProducts()
      this.cartItems = shopStore.getCart()
      if (this.selectedProduct) {
        const latest = this.products.find(p => p.id === this.selectedProduct.id)
        if (latest) this.selectedProduct = latest
      }
    },

    /**
     * 任务中心跳转：?orderNo=xx&action=pay|rebuy|view|remind
     */
    handleRouteQuery() {
      const query = this.$route.query
      if (!query.orderNo) return
      const order = taskStore.getOrderByOrderNo(query.orderNo)
      // 只处理一次，避免重复弹窗
      this.$router.replace({ path: '/shop' }).catch(() => {})
      if (!order) {
        this.showNotification('error', '订单不存在', '该订单可能已被取消或删除')
        return
      }
      if (query.action === 'rebuy') {
        if (order.status === 'cancelled' || order.status === 'completed') {
          const items = (order.extra?.items || []).map(i => ({ id: i.id, qty: i.qty }))
          const { skipped } = shopStore.refillCart(items)
          this.showCartModal = true
          if (skipped.length) {
            this.showNotification('warning', '部分商品无法加入', `${skipped.join('、')} 已售罄或下架`)
          } else {
            this.showNotification('success', '已加入购物车', '可在购物车中重新结算')
          }
        } else {
          this.showNotification('info', '订单进行中', '订单尚未完成，暂不能再次购买')
          this.loadOrders()
          this.showOrdersModal = true
        }
        return
      }
      if (query.action === 'remind') {
        this.loadOrders()
        this.showOrdersModal = true
        this.remindShipment(order)
        return
      }
      if (query.action === 'view') {
        this.loadOrders()
        this.showOrdersModal = true
        return
      }
      // 默认继续付款（待付款订单）；其它状态直接展示订单列表
      if (order.status === 'pending_payment') {
        this.resumeOrder(order)
      } else {
        this.loadOrders()
        this.showOrdersModal = true
      }
    },

    getCategoryCount(catId) {
      if (catId === 'all') return this.products.length
      return this.products.filter(p => p.category === catId).length
    },
    getCategoryName(catId) {
      return this.categories.find(c => c.id === catId)?.name || ''
    },

    openProductDetail(product) {
      this.selectedProduct = product
      this.quantity = 1
      this.showDetailModal = true
    },
    changeDetailQuantity(delta) {
      const next = this.quantity + delta
      if (next < 1 || next > this.detailMaxQty) return
      this.quantity = next
    },

    checkLoginRequired(action, product = null, qty = 1) {
      if (!isAuthenticated()) {
        this.pendingAction = action
        this.pendingProduct = product
        this.pendingQty = qty
        this.showLoginModal = true
        return false
      }
      return true
    },
    onLoginSuccess() {
      this.showLoginModal = false
      const product = this.pendingProduct
      if (this.pendingAction === 'quickAdd' && product) {
        this.applyAddToCart(product, 1)
      } else if (this.pendingAction === 'addFromDetail' && this.selectedProduct) {
        this.applyAddToCart(this.selectedProduct, this.quantity)
        this.showDetailModal = false
      } else if (this.pendingAction === 'buyNow' && this.selectedProduct) {
        this.startCheckout([{ id: this.selectedProduct.id, qty: this.quantity }])
        this.showDetailModal = false
      } else if (this.pendingAction === 'checkout') {
        this.showCartModal = false
        this.startCheckout()
      }
      this.pendingAction = null
      this.pendingProduct = null
    },

    quickAddToCart(product) {
      if (!this.checkLoginRequired('quickAdd', product, 1)) return
      this.applyAddToCart(product, 1)
    },
    addToCartFromDetail() {
      if (!this.checkLoginRequired('addFromDetail', this.selectedProduct, this.quantity)) return
      this.applyAddToCart(this.selectedProduct, this.quantity)
      this.showDetailModal = false
    },
    applyAddToCart(product, qty) {
      const result = shopStore.addToCart(product.id, qty)
      this.refreshFromStore()
      if (result.ok) {
        this.showNotification('success', '已加入购物车', `${product.name} · 共${result.qty}件`)
      } else if (result.code === 'STOCK_SHORTAGE') {
        this.showNotification('warning', '库存不足', result.message)
      } else {
        this.showNotification('error', '无法加入购物车', result.message)
      }
    },

    changeCartQty(item, delta) {
      const next = item.qty + delta
      const result = shopStore.setCartQty(item.id, next)
      this.refreshFromStore()
      if (!result.ok) {
        this.showNotification('warning', '库存不足', result.message)
      }
    },
    removeFromCart(item) {
      shopStore.removeFromCart(item.id)
      this.refreshFromStore()
    },

    buyNow() {
      if (!this.checkLoginRequired('buyNow', this.selectedProduct, this.quantity)) return
      // 立即购买不覆盖购物车，仅用所选商品发起一组结算
      this.showDetailModal = false
      this.startCheckout([{ id: this.selectedProduct.id, qty: this.quantity }])
    },

    checkout() {
      if (!this.checkLoginRequired('checkout')) return
      this.showCartModal = false
      this.startCheckout()
    },

    /**
     * 打开结算弹窗。
     * @param {Array<{id:number,qty:number}>}|null} lines 指定条目（立即购买）；
     *        不传则整组结算购物车中所有商品
     */
    startCheckout(lines = null) {
      const source = lines || this.cartItems.map(i => ({ id: i.id, qty: i.qty }))
      const view = this.emptyCheckoutView()
      view.sourceLines = source
      try {
        const quote = shopStore.validateCheckout(source)
        view.quote = quote
      } catch (err) {
        if (err instanceof ShopError && err.code === 'STOCK_SHORTAGE') {
          view.quote = shopStore.quote(source)
          view.stockError = err.message
        } else {
          this.showNotification('error', '无法结算', err.message || '请稍后重试')
          return
        }
      }
      this.checkoutView = view
      this.showCheckoutModal = true
    },

    /**
     * 从订单（任务中心 / 订单列表）继续付款：内容原样保留，不产生新订单
     */
    resumeOrder(order) {
      if (order.status !== 'pending_payment') {
        this.showOrdersModal = true
        return
      }
      const sourceLines = (order.extra?.items || []).map(i => ({ id: i.id, qty: i.qty }))
      const view = this.emptyCheckoutView()
      view.resumeOrderNo = order.extra.orderNo
      view.sourceLines = sourceLines
      view.snapshotAmount = order.extra?.snapshot?.totalAmount ?? order.amount
      view.quote = shopStore.quote(sourceLines)

      if (view.quote.totalAmount !== view.snapshotAmount) {
        view.priceChanged = true
      }
      const shortage = view.quote.lines.find(l => l.qty > l.stock)
      if (shortage) {
        view.stockError = `库存不足，${shortage.name} 仅剩 ${shortage.stock} 件`
      }
      this.showOrdersModal = false
      this.checkoutView = view
      this.showCheckoutModal = true
    },

    /** 刷新结算视图中的最新报价（价格 / 库存） */
    refreshCheckoutQuote() {
      const view = this.checkoutView
      view.quote = shopStore.quote(view.sourceLines)
      if (view.resumeOrderNo) {
        view.priceChanged = view.quote.totalAmount !== view.snapshotAmount
        if (!view.priceChanged) view.acceptNewAmount = false
      }
      const shortage = view.quote.lines.find(l => l.qty > l.stock)
      view.stockError = shortage
        ? `库存不足，${shortage.name} 仅剩 ${shortage.stock} 件`
        : ''
    },

    /** 库存不足时按可用库存调整数量（保留商品内容以便重试，仍为同一订单） */
    adjustToStock() {
      const view = this.checkoutView
      const adjusted = view.sourceLines.map(line => {
        const product = shopStore.getProduct(line.id)
        return { id: line.id, qty: Math.min(line.qty, product ? product.stock : 0) }
      }).filter(line => line.qty > 0)
      try {
        if (view.resumeOrderNo) {
          // 待付款订单：直接调整原订单条目与金额，不产生新订单
          const updated = shopStore.adjustPendingOrder(taskStore, view.resumeOrderNo, adjusted)
          view.sourceLines = adjusted
          view.snapshotAmount = updated.amount
          view.priceChanged = false
          view.acceptNewAmount = false
        } else {
          view.sourceLines = adjusted
          view.acceptNewAmount = false
        }
        this.refreshCheckoutQuote()
      } catch (err) {
        this.showNotification('error', '调整失败', err.message || '请稍后重试')
      }
    },

    onCheckoutCancel() {
      if (this.checkoutLoading) return // 支付处理中禁止误关
      // 中断支付：订单（若已生成）保留在任务中心待付款，购物车内容保留
      this.showCheckoutModal = false
      this.checkoutView = this.emptyCheckoutView()
    },

    async confirmCheckout() {
      if (this.checkoutLoading) return // 重复提交防护
      const view = this.checkoutView
      this.refreshCheckoutQuote()

      if (!view.quote.lines.length || view.quote.totalQty <= 0) {
        this.showNotification('error', '无法支付', '没有可结算的商品')
        return
      }
      if (view.stockError) {
        this.showNotification('error', '库存不足', view.stockError)
        return
      }
      if (view.priceChanged && !view.acceptNewAmount) {
        this.showNotification('warning', '金额已变化', '请勾选确认新的应付金额后再支付')
        return
      }

      this.checkoutLoading = true
      try {
        let orderNo = view.resumeOrderNo
        let usedCart = false
        if (!orderNo) {
          // 购物车 / 立即购买：创建（或幂等复用）待付款订单
          const reserved = shopStore.reserveOrder(taskStore, view.sourceLines)
          orderNo = reserved.extra.orderNo
          // 购物车结算（整组购物车条目）成功后清空；立即购买条目不动购物车
          usedCart = !view.resumeOrderNo && this.sameLines(view.sourceLines, this.cartItems.map(i => ({ id: i.id, qty: i.qty })))
        }
        const paidOrder = await shopStore.payOrder(taskStore, orderNo, {
          acceptNewAmount: view.acceptNewAmount
        })

        this.orderResult = {
          orderNo: paidOrder.extra.orderNo,
          amount: paidOrder.amount,
          totalQty: (paidOrder.extra.items || []).reduce((s, i) => s + i.qty, 0)
        }
        if (usedCart) shopStore.clearCart()

        this.checkoutLoading = false
        this.showCheckoutModal = false
        this.checkoutView = this.emptyCheckoutView()
        this.refreshFromStore()
        this.showSuccessModal = true
        this.showNotification('success', '支付成功', `订单 ${paidOrder.extra.orderNo} 已支付 ¥${paidOrder.amount}`)
      } catch (err) {
        this.checkoutLoading = false
        if (err instanceof ShopError) {
          if (err.code === 'PRICE_CHANGED') {
            view.snapshotAmount = err.details.oldAmount
            view.quote = shopStore.quote(view.sourceLines)
            view.priceChanged = true
            this.showNotification('warning', '金额发生变化', `应付金额已更新为 ¥${err.details.newAmount}，请确认后重试`)
          } else if (err.code === 'STOCK_SHORTAGE') {
            this.refreshCheckoutQuote()
            this.showNotification('error', '库存不足', err.message + '，内容已保留，可调整后重试')
          } else if (err.code === 'ORDER_CANCELLED') {
            this.showCheckoutModal = false
            this.showNotification('error', '订单已取消', '该订单已取消，请重新下单')
          } else {
            this.showNotification('error', '支付失败', err.message)
          }
        } else {
          this.showNotification('error', '支付失败', '网络异常，请稍后重试，内容已保留')
        }
      }
    },

    sameLines(a, b) {
      const key = arr => arr.map(l => `${l.id}:${l.qty}`).sort().join('|')
      return key(a) === key(b)
    },

    viewOrderDetail() {
      this.showSuccessModal = false
      this.loadOrders()
      this.showOrdersModal = true
    },
    loadOrders() {
      this.orders = taskStore.getOrders()
    },

    cancelOrder(order) {
      this.cancelTargetOrder = order
      this.showCancelOrderModal = true
    },
    async confirmCancelOrder() {
      if (!this.cancelTargetOrder || this.cancelOrderLoading) return
      this.cancelOrderLoading = true
      await new Promise(resolve => setTimeout(resolve, 500))
      try {
        shopStore.cancelOrder(taskStore, this.cancelTargetOrder.extra.orderNo)
        this.showNotification('success', '订单已取消', '未生成重复订单，可重新挑选商品')
      } catch (err) {
        this.showNotification('error', '取消失败', err.message || '请稍后重试')
      } finally {
        this.cancelOrderLoading = false
        this.showCancelOrderModal = false
        this.cancelTargetOrder = null
        this.loadOrders()
      }
    },

    remindShipment(order) {
      this.showNotification('info', '已提醒发货', `订单 ${order.extra.orderNo} 已通知商家`)
    },
    confirmReceipt(order) {
      taskStore.updateStatus(order.id, 'completed')
      this.loadOrders()
      this.showNotification('success', '确认收货成功', '感谢您的购买')
    },
    rebuyOrder(order) {
      this.showOrdersModal = false
      const items = (order.extra?.items || []).map(i => ({ id: i.id, qty: i.qty }))
      const { skipped } = shopStore.refillCart(items)
      this.showCartModal = true
      if (skipped.length) {
        this.showNotification('warning', '部分商品无法加入', `${skipped.join('、')} 已售罄或下架`)
      } else {
        this.showNotification('success', '已加入购物车', '可在购物车中重新结算')
      }
    },

    showNotification(type, title, message) {
      this.toastType = type
      this.toastTitle = title
      this.toastMessage = message
      this.showToast = true
    }
  }
}
</script>

<style scoped>
.shop-page { max-width: 1400px; margin: 0 auto; padding: 0 3rem 4rem; }
.page-header { text-align: center; padding: 1.5rem 0 2rem; }
.page-tag { display: inline-block; background: rgba(0, 217, 165, 0.1); color: var(--primary); padding: 0.5rem 1rem; border-radius: 50px; font-size: 0.85rem; font-weight: 500; margin-bottom: 1rem; }
.page-header h1 { font-family: 'Space Grotesk', sans-serif; font-size: 3rem; font-weight: 700; margin-bottom: 0.75rem; }
.page-header p { color: var(--text-secondary); font-size: 1.1rem; }
.shop-layout { display: grid; grid-template-columns: 240px 1fr; gap: 2rem; align-items: start; }
.sidebar { position: sticky; top: 100px; height: fit-content; }
.section-title { font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; color: var(--text-secondary); }
.category-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 1rem; }
.category-list { display: flex; flex-direction: column; gap: 0.25rem; }
.category-list button { display: flex; align-items: center; gap: 0.75rem; width: 100%; background: transparent; border: none; padding: 0.75rem 1rem; color: var(--text-secondary); font-size: 0.9rem; border-radius: 10px; cursor: pointer; transition: all 0.3s; text-align: left; }
.category-list button:hover { background: rgba(255, 255, 255, 0.03); color: var(--text-primary); }
.category-list button.active { background: rgba(0, 217, 165, 0.1); color: var(--primary); }
.cat-icon { font-size: 1.1rem; }
.cat-name { flex: 1; }
.cat-count { font-size: 0.75rem; color: var(--text-muted); background: rgba(255, 255, 255, 0.05); padding: 0.2rem 0.5rem; border-radius: 10px; }
.category-list button.active .cat-count { background: rgba(0, 217, 165, 0.2); color: var(--primary); }
.content-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; margin-top: -6.8rem; }
.result-count { color: var(--text-secondary); font-size: 0.9rem; font-weight: 600; }
.result-count span { color: var(--primary); font-weight: 600; }
.sort-select { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 1rem; color: var(--text-primary); font-size: 0.85rem; cursor: pointer; }
.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.25rem; }
.product-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; overflow: hidden; cursor: pointer; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.product-card:hover { transform: translateY(-6px); border-color: rgba(255, 255, 255, 0.15); }
.product-image { position: relative; height: 160px; background: linear-gradient(135deg, var(--bg-card-hover) 0%, var(--bg-card) 100%); display: flex; align-items: center; justify-content: center; }
.image-placeholder { font-size: 4rem; opacity: 0.8; }
.product-badges { position: absolute; top: 0.75rem; left: 0.75rem; display: flex; gap: 0.4rem; flex-wrap: wrap; }
.badge { padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 600; }
.badge.hot { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
.badge.new { background: rgba(0, 217, 165, 0.2); color: var(--primary); }
.badge.lowstock { background: rgba(255, 193, 7, 0.2); color: #ffc107; }
.badge.soldout { background: rgba(108, 117, 125, 0.3); color: #adb5bd; }
.quick-add { position: absolute; bottom: 0.75rem; right: 0.75rem; width: 40px; height: 40px; background: var(--primary); border: none; border-radius: 10px; color: var(--bg-dark); cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(10px); transition: all 0.3s; }
.product-card:hover .quick-add { opacity: 1; transform: translateY(0); }
.quick-add:hover { transform: scale(1.1); }
.quick-add svg { width: 20px; height: 20px; }
.product-info { padding: 1.25rem; }
.product-brand { font-size: 0.75rem; color: var(--primary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
.product-info h3 { font-size: 1rem; font-weight: 600; margin: 0.4rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.product-desc { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.product-footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 0.5rem; }
.price-info { display: flex; align-items: baseline; gap: 0.5rem; }
.current-price { font-family: 'Space Grotesk', sans-serif; font-size: 1.25rem; font-weight: 700; color: var(--primary); }
.original-price { font-size: 0.8rem; color: var(--text-muted); text-decoration: line-through; }
.sales { font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; }
</style>

<style scoped>
.cart-float { position: fixed; bottom: 2rem; right: 2rem; display: flex; align-items: center; gap: 1rem; background: var(--bg-card); border: 1px solid var(--border); padding: 1rem 1.5rem; border-radius: 50px; cursor: pointer; transition: all 0.3s; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3); z-index: 100; }
.cart-float:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: var(--shadow-glow); }
.cart-icon { position: relative; }
.cart-icon svg { width: 24px; height: 24px; color: var(--primary); }
.cart-count { position: absolute; top: -8px; right: -8px; background: var(--primary); color: var(--bg-dark); min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.cart-total { font-family: 'Space Grotesk', sans-serif; font-size: 1.1rem; font-weight: 700; color: var(--primary); }
.product-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: -20px -24px; }
.detail-image { background: linear-gradient(135deg, var(--bg-card-hover) 0%, var(--bg-card) 100%); display: flex; align-items: center; justify-content: center; min-height: 300px; }
.detail-icon { font-size: 8rem; }
.detail-info { padding: 2rem 2rem 2rem 0; display: flex; flex-direction: column; }
.detail-brand { font-size: 0.85rem; color: var(--primary); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; }
.detail-info h2 { font-family: 'Space Grotesk', sans-serif; font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; }
.detail-desc { color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }
.detail-specs { display: flex; gap: 2rem; margin-bottom: 1.5rem; }
.spec-item { display: flex; flex-direction: column; gap: 0.25rem; }
.spec-item .label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; }
.spec-item .value { font-size: 0.9rem; }
.spec-item .value.stock-low { color: #ffc107; font-weight: 600; }
.detail-price { display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 1.5rem; }
.detail-price .current { font-family: 'Space Grotesk', sans-serif; font-size: 2.5rem; font-weight: 700; color: var(--primary); }
.detail-price .original { font-size: 1.1rem; color: var(--text-muted); text-decoration: line-through; }
.quantity-selector { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.qty-label { font-size: 0.9rem; color: var(--text-secondary); }
.qty-controls { display: flex; align-items: center; background: rgba(255, 255, 255, 0.05); border-radius: 10px; overflow: hidden; }
.qty-controls button { width: 40px; height: 40px; background: transparent; border: none; color: var(--text-primary); font-size: 1.25rem; cursor: pointer; transition: background 0.2s; }
.qty-controls button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
.qty-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
.qty-controls span { width: 50px; text-align: center; font-weight: 600; }
.qty-hint { font-size: 0.78rem; color: #ffc107; }
.qty-hint.danger { color: #ff6b6b; }
.detail-actions { display: flex; gap: 1rem; margin-top: auto; }
.btn-add-cart, .btn-buy-now { flex: 1; padding: 1rem; font-size: 1rem; font-weight: 600; border-radius: 12px; cursor: pointer; transition: all 0.3s; }
.btn-add-cart { background: transparent; border: 1px solid var(--primary); color: var(--primary); }
.btn-add-cart:hover:not(:disabled) { background: rgba(0, 217, 165, 0.1); }
.btn-buy-now { background: var(--gradient-1); border: none; color: var(--bg-dark); }
.btn-buy-now:hover:not(:disabled) { box-shadow: 0 8px 25px var(--primary-glow); }
.btn-add-cart:disabled, .btn-buy-now:disabled { opacity: 0.4; cursor: not-allowed; }
.cart-content { margin: -20px -24px -20px -24px; }
.cart-items { max-height: 400px; overflow-y: auto; padding: 1rem 1.5rem; }
.cart-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; margin-bottom: 0.75rem; }
.item-icon { font-size: 2rem; width: 50px; height: 50px; background: var(--bg-card-hover); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.item-info { flex: 1; min-width: 0; }
.item-info h4 { font-size: 0.9rem; font-weight: 500; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-brand { font-size: 0.72rem; color: var(--text-muted); }
.cart-qty-controls { display: flex; align-items: center; background: rgba(255, 255, 255, 0.05); border-radius: 8px; overflow: hidden; }
.cart-qty-controls button { width: 28px; height: 28px; background: transparent; border: none; color: var(--text-primary); font-size: 1rem; cursor: pointer; }
.cart-qty-controls button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
.cart-qty-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
.cart-qty-controls span { width: 34px; text-align: center; font-size: 0.85rem; font-weight: 600; }
.item-price { font-family: 'Space Grotesk', sans-serif; font-weight: 600; color: var(--primary); min-width: 60px; text-align: right; }
.remove-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 0.4rem; border-radius: 6px; transition: all 0.3s; }
.remove-btn:hover { background: rgba(255, 107, 107, 0.1); color: #ff6b6b; }
.remove-btn svg { width: 16px; height: 16px; }
.cart-empty { padding: 3rem; text-align: center; color: var(--text-muted); }
.empty-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
.cart-footer { padding: 1.5rem; border-top: 1px solid var(--border); }
.cart-summary { display: flex; justify-content: space-between; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem; }
.cart-summary .total strong { font-family: 'Space Grotesk', sans-serif; font-size: 1.25rem; color: var(--primary); }
.btn-checkout { width: 100%; background: var(--gradient-1); border: none; color: var(--bg-dark); padding: 1rem; font-size: 1rem; font-weight: 600; border-radius: 12px; cursor: pointer; transition: all 0.3s; }
.btn-checkout:hover { box-shadow: 0 8px 30px var(--primary-glow); }
.checkout-info { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; text-align: left; }
.checkout-items { display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; }
.checkout-item { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; }
.ci-icon { font-size: 1.1rem; }
.ci-name { flex: 1; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ci-qty { color: var(--text-muted); }
.ci-price { font-family: 'Space Grotesk', sans-serif; font-weight: 600; color: var(--primary); min-width: 70px; text-align: right; }
.info-row { display: flex; justify-content: space-between; font-size: 0.9rem; }
.info-row .label { color: var(--text-secondary); }
.info-row .value { font-weight: 500; }
.info-row .value.mono { font-family: monospace; font-size: 0.85rem; }
.info-row.total { border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.25rem; }
.info-row .value.price { font-family: 'Space Grotesk', sans-serif; font-size: 1.25rem; color: var(--primary); }
.checkout-alert { display: flex; gap: 0.75rem; padding: 0.85rem 1rem; border-radius: 10px; font-size: 0.82rem; text-align: left; }
.checkout-alert.warning { background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); color: #ffc107; }
.checkout-alert.error { background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); color: #ff6b6b; }
.alert-icon { font-size: 1.1rem; }
.alert-body p { margin: 0; }
.alert-body .alert-detail { color: var(--text-secondary); margin-top: 0.2rem !important; }
.alert-body .alert-detail strong { color: var(--primary); font-family: 'Space Grotesk', sans-serif; }
.alert-confirm { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem; color: var(--text-primary); cursor: pointer; }
.alert-confirm input { accent-color: var(--primary); }
.btn-inline-fix { margin-top: 0.5rem; background: transparent; border: 1px solid rgba(255, 107, 107, 0.4); color: #ff6b6b; padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.78rem; cursor: pointer; }
.btn-inline-fix:hover { background: rgba(255, 107, 107, 0.1); }
.checkout-tip { font-size: 0.75rem; color: var(--text-muted); text-align: center; margin: 0; }
.success-info { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; text-align: left; }
@media (max-width: 900px) { .shop-layout { grid-template-columns: 1fr; } .sidebar { position: static; } .product-detail { grid-template-columns: 1fr; } .detail-image { min-height: 200px; } .detail-info { padding: 1.5rem; } }
@media (max-width: 600px) { .shop-page { padding: 0 1.5rem 3rem; } .page-header h1 { font-size: 2rem; } .products-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; } .product-image { height: 120px; } .image-placeholder { font-size: 3rem; } }
</style>


<style scoped>
/* Orders Modal Styles */
.orders-content { margin: -20px -24px; }
.orders-list { max-height: 460px; overflow-y: auto; padding: 1rem 1.5rem; }
.order-card { background: rgba(255, 255, 255, 0.03); border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem; }
.order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.order-no { font-family: monospace; font-size: 0.85rem; color: var(--text-secondary); }
.order-status { padding: 0.25rem 0.6rem; border-radius: 12px; font-size: 0.7rem; font-weight: 600; }
.order-status.pending_payment { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
.order-status.pending_shipment { background: rgba(0, 217, 165, 0.15); color: var(--primary); }
.order-status.shipped { background: rgba(79, 172, 254, 0.15); color: #4facfe; }
.order-status.completed { background: rgba(108, 117, 125, 0.15); color: #6c757d; }
.order-status.cancelled { background: rgba(255, 107, 107, 0.15); color: #ff6b6b; }
.order-items { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
.order-item { display: flex; align-items: center; gap: 0.4rem; background: rgba(255, 255, 255, 0.05); padding: 0.4rem 0.6rem; border-radius: 8px; font-size: 0.8rem; }
.order-item .item-icon { font-size: 1rem; width: auto; height: auto; background: none; }
.item-name { color: var(--text-secondary); }
.item-qty { color: var(--text-muted); }
.order-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid var(--border); }
.order-time { font-size: 0.75rem; color: var(--text-muted); }
.order-amount { font-family: 'Space Grotesk', sans-serif; font-weight: 700; color: var(--primary); }
.order-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.order-btn { padding: 0.45rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
.order-btn.primary { background: var(--gradient-1); color: var(--bg-dark); border: none; }
.order-btn.default { background: rgba(255, 255, 255, 0.05); border-color: var(--border); color: var(--text-primary); }
.order-btn.danger { background: rgba(255, 107, 107, 0.1); border-color: rgba(255, 107, 107, 0.3); color: #ff6b6b; }
.orders-empty { padding: 3rem; text-align: center; color: var(--text-muted); }
.orders-empty .empty-icon { font-size: 3rem; margin-bottom: 0.5rem; opacity: 0.5; }
</style>
