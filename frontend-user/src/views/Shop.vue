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
          <div class="header-tools">
            <button class="orders-entry" @click="showOrdersModal = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              我的订单
            </button>
            <select v-model="sortBy" class="sort-select">
              <option value="default">默认排序</option>
              <option value="price-asc">价格从低到高</option>
              <option value="price-desc">价格从高到低</option>
            </select>
          </div>
        </div>

        <div class="products-grid">
          <div v-for="product in sortedProducts" :key="product.id" class="product-card" @click="openProductDetail(product)">
            <div class="product-image">
              <div class="image-placeholder">{{ product.icon }}</div>
              <div class="product-badges">
                <span v-if="product.hot" class="badge hot">热销</span>
                <span v-if="product.new" class="badge new">新品</span>
                <span v-if="getAvailableStock(product.id) === 0" class="badge soldout">已售罄</span>
              </div>
              <button
                v-if="getAvailableStock(product.id) > 0"
                class="quick-add"
                :class="{ added: cartQtyOf(product.id) > 0 }"
                @click.stop="quickAddToCart(product)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                <span v-if="cartQtyOf(product.id) > 0" class="quick-add-qty">{{ cartQtyOf(product.id) }}</span>
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
                <span class="sales" :class="{ low: getAvailableStock(product.id) <= 5 && getAvailableStock(product.id) > 0 }">
                  {{ getAvailableStock(product.id) === 0 ? '已售罄' : getAvailableStock(product.id) <= 5 ? `仅剩 ${getAvailableStock(product.id)} 件` : `已售 ${product.sales}` }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Cart Float -->
    <div v-if="cart.length > 0" class="cart-float" @click="showCartModal = true">
      <div class="cart-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <span class="cart-count">{{ cartItemCount }}</span>
      </div>
      <div class="cart-float-info">
        <span class="cart-float-total">¥{{ cartTotal }}</span>
        <span class="cart-float-count">共 {{ cartItemCount }} 件</span>
      </div>
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
            <div class="spec-item"><span class="label">库存</span><span class="value" :class="{ 'stock-low': detailAvailable <= 5 }">{{ detailAvailable }} 件</span></div>
          </div>
          <div class="detail-price">
            <span class="current">¥{{ selectedProduct.price }}</span>
            <span v-if="selectedProduct.originalPrice" class="original">¥{{ selectedProduct.originalPrice }}</span>
          </div>
          <div class="quantity-selector">
            <span class="qty-label">数量</span>
            <div class="qty-controls">
              <button :disabled="quantity <= 1 || detailAvailable === 0" @click="quantity--">-</button>
              <span>{{ quantity }}</span>
              <button :disabled="quantity >= detailAvailable" @click="quantity < detailAvailable && quantity++">+</button>
            </div>
            <span v-if="detailAvailable <= 5 && detailAvailable > 0" class="qty-hint">仅剩 {{ detailAvailable }} 件</span>
            <span v-else-if="detailAvailable === 0" class="qty-hint danger">暂时缺货</span>
          </div>
          <div class="detail-actions">
            <button class="btn-add-cart" :disabled="detailAvailable === 0" @click="addToCartFromDetail">加入购物车</button>
            <button class="btn-buy-now" :disabled="detailAvailable === 0" @click="buyNow">立即购买</button>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Cart Modal -->
    <Modal v-model="showCartModal" title="购物车" size="medium" :show-footer="false">
      <div class="cart-content">
        <div v-if="cart.length > 0" class="cart-items">
          <div v-for="item in cart" :key="item.id" class="cart-item">
            <div class="item-icon">{{ item.icon }}</div>
            <div class="item-info">
              <h4>{{ item.name }}</h4>
              <span class="item-brand">{{ item.brand }} · ¥{{ item.price }}</span>
            </div>
            <div class="item-qty-stepper">
              <button :disabled="item.qty <= 1" @click="changeCartQty(item, -1)">-</button>
              <span>{{ item.qty }}</span>
              <button :disabled="item.qty >= getAvailableStock(item.id)" @click="changeCartQty(item, 1)">+</button>
            </div>
            <div class="item-price">¥{{ item.price * item.qty }}</div>
            <button class="remove-btn" @click="removeFromCart(item)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div v-else class="cart-empty"><div class="empty-icon">🛒</div><p>购物车是空的</p></div>
        <div v-if="cart.length > 0" class="cart-footer">
          <div class="cart-summary"><span>共 {{ cartItemCount }} 件商品</span><span class="total">合计：<strong>¥{{ cartTotal }}</strong></span></div>
          <button class="btn-checkout" @click="checkout">去结算（{{ cartItemCount }} 件）</button>
        </div>
      </div>
    </Modal>

    <!-- Checkout / Payment Modal -->
    <Modal
      v-model="showCheckoutModal"
      icon="🛒"
      icon-type="info"
      :title="activeOrder ? '确认支付' : '确认订单'"
      subtitle="请核对商品与金额，支付过程中订单将为您保留"
      size="small"
    >
      <div class="checkout-info">
        <div class="checkout-items">
          <div v-for="item in checkoutItems" :key="item.id" class="checkout-item">
            <span class="ci-icon">{{ item.icon }}</span>
            <span class="ci-name">{{ item.name }}</span>
            <span class="ci-qty">x{{ item.qty }}</span>
            <span class="ci-price">¥{{ item.price * item.qty }}</span>
          </div>
        </div>
        <div class="info-row"><span class="label">商品数量</span><span class="value">{{ checkoutItemCount }} 件</span></div>
        <div v-if="activeOrder" class="info-row"><span class="label">订单编号</span><span class="value mono">{{ activeOrder.orderNo }}</span></div>
        <div v-if="checkoutAmountChanged" class="amount-notice">
          ⚠️ 商品金额已发生变化，已按最新价格更新应付金额，请确认后重新支付
        </div>
        <div v-else-if="checkoutError" class="amount-notice error">
          {{ checkoutError }}
        </div>
        <div v-if="activeOrder && activeOrder.surcharge" class="info-row"><span class="label">金额调整</span><span class="value surcharge">+¥{{ activeOrder.surcharge }}</span></div>
        <div class="info-row total"><span class="label">应付金额</span><span class="value price">¥{{ checkoutAmount }}</span></div>

        <div class="fault-simulator">
          <span class="fault-label">模拟支付场景</span>
          <select v-model="paymentFault" class="fault-select" :disabled="paying">
            <option value="normal">正常支付</option>
            <option value="gateway">支付中断（网关失败）</option>
            <option value="stock">库存不足</option>
            <option value="price">金额变化</option>
          </select>
        </div>
        <p class="fault-tip">支付失败后订单与商品内容会原样保留，可直接重试；同一订单不会重复扣款或生成重复订单。</p>
      </div>
      <template #footer>
        <button class="btn-back" :disabled="paying" @click="backToMall">返回商城</button>
        <button v-if="activeOrder && activeOrder.status === 'pending_payment'" class="btn-cancel-order" :disabled="paying" @click="cancelActiveOrder">取消订单</button>
        <button class="btn-pay" :disabled="paying" @click="confirmCheckout">
          <span v-if="paying" class="btn-loading"></span>
          <span>{{ paying ? '支付处理中...' : '确认支付' }}</span>
        </button>
      </template>
    </Modal>

    <!-- Success Modal -->
    <Modal v-model="showSuccessModal" icon="🎉" icon-type="success" title="支付成功" subtitle="您的订单已提交" size="small" :show-cancel="false" confirm-text="查看订单" @confirm="viewOrderDetail">
      <div v-if="orderResult" class="success-info">
        <div class="info-row"><span class="label">订单编号</span><span class="value mono">{{ orderResult.orderNo }}</span></div>
        <div class="info-row"><span class="label">商品数量</span><span class="value">{{ successItemCount }} 件</span></div>
        <div class="info-row"><span class="label">支付金额</span><span class="value price">¥{{ orderResult.amount }}</span></div>
      </div>
    </Modal>

    <!-- Orders Modal -->
    <Modal v-model="showOrdersModal" title="我的订单" size="medium" :show-footer="false">
      <div class="orders-content">
        <div v-if="orders.length > 0" class="orders-list">
          <div v-for="order in orders" :key="order.orderNo" class="order-card">
            <div class="order-header">
              <span class="order-no">{{ order.orderNo }}</span>
              <span class="order-status" :class="order.status">{{ orderStatusText(order.status) }}</span>
            </div>
            <div class="order-items">
              <div v-for="item in order.items" :key="item.id" class="order-item">
                <span class="item-icon">{{ item.icon }}</span>
                <span class="item-name">{{ item.name }}</span>
                <span class="item-qty">x{{ item.qty }}</span>
              </div>
            </div>
            <div class="order-footer">
              <span class="order-time">{{ order.createTime }}</span>
              <span class="order-amount">¥{{ order.amount }}</span>
            </div>
            <div v-if="order.status !== 'cancelled'" class="order-actions">
              <button v-if="order.status === 'pending_payment'" class="order-btn primary" @click="resumeOrder(order.orderNo)">继续付款</button>
              <button v-if="order.status === 'pending_payment'" class="order-btn danger" @click="cancelOrderFromList(order.orderNo)">取消订单</button>
              <button v-if="order.status === 'paid'" class="order-btn default" @click="rebuyOrder(order)">再次购买</button>
            </div>
          </div>
        </div>
        <div v-else class="orders-empty">
          <div class="empty-icon">📦</div>
          <p>暂无订单</p>
        </div>
      </div>
    </Modal>

    <Toast v-model="showToast" :type="toastType" :title="toastTitle" :message="toastMessage" />

    <LoginModal v-model="showLoginModal" @login-success="onLoginSuccess" />
  </div>
</template>

<script>
import Modal from '../components/Modal.vue'
import Toast from '../components/Toast.vue'
import LoginModal from '../components/LoginModal.vue'
import { isAuthenticated } from '../utils/auth'
import { shopStore, products as catalogProducts } from '../utils/shopStore'

export default {
  name: 'Shop',
  components: { Modal, Toast, LoginModal },
  data() {
    return {
      selectedCategory: 'all',
      sortBy: 'default',
      showDetailModal: false,
      showCartModal: false,
      showCheckoutModal: false,
      showSuccessModal: false,
      showOrdersModal: false,
      selectedProduct: null,
      quantity: 1,
      orderResult: null,
      // 结算流程状态
      activeOrderNo: null, // 当前结算关联的订单号（下单后即固定，重试 / 中断都复用）
      activeSource: 'cart', // cart | buyNow
      paying: false,
      paymentFault: 'normal', // normal | gateway | stock | price
      checkoutError: '',
      showToast: false,
      toastType: 'success',
      toastTitle: '',
      toastMessage: '',
      showLoginModal: false,
      pendingAction: null,
      pendingPayload: null,
      categories: [
        { id: 'all', name: '全部商品', icon: '🏷️' },
        { id: 'cue', name: '球杆', icon: '🏏' },
        { id: 'ball', name: '台球', icon: '🎱' },
        { id: 'accessory', name: '配件', icon: '🔧' },
        { id: 'clothing', name: '服装', icon: '👔' }
      ],
      products: catalogProducts
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
    cart() {
      return shopStore.state.cart
    },
    orders() {
      return shopStore.getAllOrders()
    },
    cartTotal() {
      return shopStore.getCartTotal()
    },
    cartItemCount() {
      return shopStore.getCartCount()
    },
    activeOrder() {
      return this.activeOrderNo ? shopStore.getOrder(this.activeOrderNo) : null
    },
    checkoutItems() {
      return this.activeOrder ? this.activeOrder.items : []
    },
    checkoutItemCount() {
      return this.checkoutItems.reduce((sum, i) => sum + i.qty, 0)
    },
    checkoutAmount() {
      return this.activeOrder ? this.activeOrder.amount : 0
    },
    checkoutAmountChanged() {
      return this.checkoutError === 'amount_changed'
    },
    detailAvailable() {
      return this.selectedProduct ? shopStore.getAvailableStock(this.selectedProduct.id) : 0
    },
    successItemCount() {
      return this.orderResult ? this.orderResult.items.reduce((sum, i) => sum + i.qty, 0) : 0
    }
  },
  mounted() {
    // 从任务中心「继续付款」返回商城：恢复同一笔待付款订单
    const orderNo = this.$route.query.orderNo
    if (orderNo) {
      this.resumeOrder(orderNo, { fromRoute: true })
      this.$router.replace({ path: '/shop' }).catch(() => {})
    }
  },
  methods: {
    getCategoryCount(catId) {
      if (catId === 'all') return this.products.length
      return this.products.filter(p => p.category === catId).length
    },
    getCategoryName(catId) {
      return this.categories.find(c => c.id === catId)?.name || ''
    },
    getAvailableStock(productId) {
      return shopStore.getAvailableStock(productId)
    },
    cartQtyOf(productId) {
      return shopStore.getCartQty(productId)
    },
    orderStatusText(status) {
      return { pending_payment: '待付款', paid: '已支付', cancelled: '已取消' }[status] || status
    },
    openProductDetail(product) {
      this.selectedProduct = product
      this.quantity = 1
      this.showDetailModal = true
    },
    checkLoginRequired(action, payload = null) {
      if (!isAuthenticated()) {
        this.pendingAction = action
        this.pendingPayload = payload
        this.showLoginModal = true
        return false
      }
      return true
    },
    onLoginSuccess() {
      this.showLoginModal = false
      const action = this.pendingAction
      const payload = this.pendingPayload
      this.pendingAction = null
      this.pendingPayload = null
      if (action === 'quickAdd' && payload) {
        this.doAddToCart(payload.id, 1, payload.name)
      } else if (action === 'addFromDetail') {
        this.doAddToCart(this.selectedProduct.id, this.quantity, this.selectedProduct.name)
        this.showDetailModal = false
      } else if (action === 'buyNow') {
        this.startCheckout('buyNow', payload.items)
      } else if (action === 'checkout') {
        this.startCheckout('cart', this.buildCartSnapshot())
      } else if (action === 'resume' && payload) {
        this.resumeOrder(payload.orderNo)
      }
    },
    buildCartSnapshot() {
      return this.cart.map(i => ({ ...i }))
    },
    doAddToCart(productId, qty, name) {
      const result = shopStore.addToCart(productId, qty)
      if (result.ok) {
        this.showNotification('success', '已加入购物车', `${name} x${qty}`)
      } else {
        this.showNotification('warning', '无法加入购物车', result.error)
      }
      return result.ok
    },
    quickAddToCart(product) {
      if (!this.checkLoginRequired('quickAdd', { id: product.id, name: product.name })) return
      this.doAddToCart(product.id, 1, product.name)
    },
    addToCartFromDetail() {
      if (!this.checkLoginRequired('addFromDetail')) return
      if (this.doAddToCart(this.selectedProduct.id, this.quantity, this.selectedProduct.name)) {
        this.showDetailModal = false
      }
    },
    changeCartQty(item, delta) {
      const result = shopStore.setCartQty(item.id, item.qty + delta)
      if (!result.ok) {
        this.showNotification('warning', '数量无法调整', result.error)
      }
    },
    removeFromCart(item) {
      shopStore.removeFromCart(item.id)
    },
    buyNow() {
      if (!isAuthenticated()) {
        const items = [{
          id: this.selectedProduct.id,
          name: this.selectedProduct.name,
          brand: this.selectedProduct.brand,
          icon: this.selectedProduct.icon,
          price: this.selectedProduct.price,
          qty: this.quantity
        }]
        this.checkLoginRequired('buyNow', { items })
        return
      }
      const items = [{
        id: this.selectedProduct.id,
        name: this.selectedProduct.name,
        brand: this.selectedProduct.brand,
        icon: this.selectedProduct.icon,
        price: this.selectedProduct.price,
        qty: this.quantity
      }]
      this.startCheckout('buyNow', items)
    },
    checkout() {
      if (!this.checkLoginRequired('checkout')) return
      this.startCheckout('cart', this.buildCartSnapshot())
    },
    /**
     * 进入结算：相同结算内容复用已有待付款订单，绝不重复建单
     */
    startCheckout(source, items) {
      if (!items || items.length === 0) {
        this.showNotification('warning', '购物车是空的', '请先选择商品')
        return
      }
      const existed = shopStore.findPendingOrder(items, source)
      let order = existed
      if (!order) {
        const created = shopStore.createPendingOrder(items, source)
        if (!created.ok) {
          this.showNotification('error', '无法结算', created.error)
          return
        }
        order = created.order
      }
      this.openCheckout(order.orderNo, source)
    },
    openCheckout(orderNo, source) {
      this.activeOrderNo = orderNo
      this.activeSource = source
      this.paymentFault = 'normal'
      this.checkoutError = ''
      this.showCartModal = false
      this.showDetailModal = false
      this.showCheckoutModal = true
    },
    /**
     * 继续付款（任务中心 / 我的订单 / 路由参数恢复）
     */
    resumeOrder(orderNo, options = {}) {
      const order = shopStore.getOrder(orderNo)
      if (!order) {
        if (!options.fromRoute) this.showNotification('error', '订单不存在', '请重新选择商品下单')
        return
      }
      if (order.status === 'paid') {
        this.orderResult = order
        this.showSuccessModal = true
        return
      }
      if (order.status === 'cancelled') {
        this.showNotification('warning', '订单已取消', '请重新选择商品下单')
        return
      }
      if (!isAuthenticated()) {
        this.checkLoginRequired('resume', { orderNo })
        return
      }
      this.showOrdersModal = false
      this.openCheckout(order.orderNo, order.origin)
      if (options.fromRoute) {
        this.showNotification('info', '已恢复未完成订单', `订单 ${order.orderNo} 可继续付款`)
      }
    },
    async confirmCheckout() {
      if (this.paying || !this.activeOrder) return
      this.paying = true
      this.checkoutError = ''
      try {
        const result = await shopStore.submitCheckout({
          items: this.activeOrder.items,
          source: this.activeSource,
          fault: this.paymentFault,
          orderNo: this.activeOrder.orderNo
        })
        if (result.ok) {
          this.orderResult = result.order
          this.showCheckoutModal = false
          this.showSuccessModal = true
          if (result.duplicated) {
            this.showNotification('info', '该订单已支付', '请勿重复提交')
          } else {
            this.showNotification('success', '支付成功', `订单 ${result.order.orderNo} 已提交`)
          }
          this.activeOrderNo = null
        } else {
          this.handlePayFailure(result)
        }
      } finally {
        this.paying = false
      }
    },
    handlePayFailure(result) {
      if (result.code === 'in_flight') {
        this.showNotification('warning', '请勿重复提交', result.error)
        return
      }
      if (result.code === 'cancelled') {
        this.showNotification('warning', '订单已取消', '请重新选择商品下单')
        this.showCheckoutModal = false
        this.activeOrderNo = null
        return
      }
      // 网关失败 / 库存不足 / 金额变化：订单原样保留，订单号不变，可直接重试
      if (result.order && result.order.orderNo) {
        this.activeOrderNo = result.order.orderNo
      }
      this.checkoutError = result.code === 'amount_changed' ? 'amount_changed' : result.error
      const toastMap = {
        gateway: ['error', '支付中断', result.error],
        stock: ['error', '库存不足', result.error],
        amount_changed: ['warning', '金额已变化', result.error]
      }
      const toast = toastMap[result.code]
      if (toast) this.showNotification(toast[0], toast[1], toast[2])
    },
    /**
     * 返回商城：保留待付款订单与购物车内容，可从任务中心 / 我的订单继续付款
     */
    backToMall() {
      if (this.activeOrder) {
        this.showNotification('info', '订单已保留', `订单 ${this.activeOrder.orderNo} 可稍后在任务中心继续付款`)
      }
      this.showCheckoutModal = false
    },
    /**
     * 取消订单：取消当前待付款订单并释放预留库存
     */
    cancelActiveOrder() {
      if (!this.activeOrder || this.activeOrder.status !== 'pending_payment') {
        this.showCheckoutModal = false
        return
      }
      const orderNo = this.activeOrder.orderNo
      const result = shopStore.cancelOrder(orderNo)
      if (result.ok) {
        this.showNotification('success', '订单已取消', '库存已释放，可重新下单')
        this.activeOrderNo = null
        this.showCheckoutModal = false
      } else {
        this.showNotification('error', '取消失败', result.error)
      }
    },
    cancelOrderFromList(orderNo) {
      const result = shopStore.cancelOrder(orderNo)
      if (result.ok) {
        this.showNotification('success', '订单已取消', '库存已释放，可重新下单')
      } else {
        this.showNotification('error', '取消失败', result.error)
      }
    },
    rebuyOrder(order) {
      let failed = false
      order.items.forEach(item => {
        const result = shopStore.addToCart(item.id, item.qty)
        if (!result.ok) failed = true
      })
      if (failed) {
        this.showNotification('warning', '部分商品库存不足', '已尽可能加入购物车，请调整数量')
      } else {
        this.showNotification('success', '已加入购物车', '可在购物车中重新结算')
      }
      this.showOrdersModal = false
      this.showCartModal = true
    },
    viewOrderDetail() {
      this.showSuccessModal = false
      this.showOrdersModal = true
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
.header-tools { display: flex; align-items: center; gap: 0.75rem; }
.result-count { color: var(--text-secondary); font-size: 0.9rem; font-weight: 600; }
.result-count span { color: var(--primary); font-weight: 600; }
.orders-entry { display: flex; align-items: center; gap: 0.4rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 1rem; color: var(--text-secondary); font-size: 0.85rem; cursor: pointer; transition: all 0.3s; }
.orders-entry:hover { color: var(--primary); border-color: var(--primary); }
.orders-entry svg { width: 16px; height: 16px; }
.sort-select { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 1rem; color: var(--text-primary); font-size: 0.85rem; cursor: pointer; }
.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.25rem; }
.product-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; overflow: hidden; cursor: pointer; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.product-card:hover { transform: translateY(-6px); border-color: rgba(255, 255, 255, 0.15); }
.product-image { position: relative; height: 160px; background: linear-gradient(135deg, var(--bg-card-hover) 0%, var(--bg-card) 100%); display: flex; align-items: center; justify-content: center; }
.image-placeholder { font-size: 4rem; opacity: 0.8; }
.product-badges { position: absolute; top: 0.75rem; left: 0.75rem; display: flex; gap: 0.4rem; }
.badge { padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 600; }
.badge.hot { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
.badge.new { background: rgba(0, 217, 165, 0.2); color: var(--primary); }
.badge.soldout { background: rgba(140, 140, 150, 0.25); color: #b0b0be; }
.quick-add { position: absolute; bottom: 0.75rem; right: 0.75rem; min-width: 40px; height: 40px; padding: 0 8px; background: var(--primary); border: none; border-radius: 10px; color: var(--bg-dark); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; opacity: 0; transform: translateY(10px); transition: all 0.3s; }
.product-card:hover .quick-add { opacity: 1; transform: translateY(0); }
.quick-add:hover { transform: scale(1.1); }
.quick-add.added { opacity: 1; transform: translateY(0); }
.quick-add svg { width: 20px; height: 20px; }
.quick-add-qty { font-size: 0.8rem; font-weight: 700; }
.product-info { padding: 1.25rem; }
.product-brand { font-size: 0.75rem; color: var(--primary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
.product-info h3 { font-size: 1rem; font-weight: 600; margin: 0.4rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.product-desc { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.product-footer { display: flex; justify-content: space-between; align-items: flex-end; }
.price-info { display: flex; align-items: baseline; gap: 0.5rem; }
.current-price { font-family: 'Space Grotesk', sans-serif; font-size: 1.25rem; font-weight: 700; color: var(--primary); }
.original-price { font-size: 0.8rem; color: var(--text-muted); text-decoration: line-through; }
.sales { font-size: 0.75rem; color: var(--text-muted); }
.sales.low { color: #ffc107; font-weight: 600; }
</style>

<style scoped>
.cart-float { position: fixed; bottom: 2rem; right: 2rem; display: flex; align-items: center; gap: 1rem; background: var(--bg-card); border: 1px solid var(--border); padding: 0.9rem 1.5rem; border-radius: 50px; cursor: pointer; transition: all 0.3s; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3); z-index: 100; }
.cart-float:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: var(--shadow-glow); }
.cart-icon { position: relative; }
.cart-icon svg { width: 24px; height: 24px; color: var(--primary); }
.cart-count { position: absolute; top: -8px; right: -8px; background: var(--primary); color: var(--bg-dark); min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.cart-float-info { display: flex; flex-direction: column; line-height: 1.2; }
.cart-float-total { font-family: 'Space Grotesk', sans-serif; font-size: 1.05rem; font-weight: 700; color: var(--primary); }
.cart-float-count { font-size: 0.7rem; color: var(--text-muted); }
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
.quantity-selector { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.qty-label { font-size: 0.9rem; color: var(--text-secondary); }
.qty-controls { display: flex; align-items: center; background: rgba(255, 255, 255, 0.05); border-radius: 10px; overflow: hidden; }
.qty-controls button { width: 40px; height: 40px; background: transparent; border: none; color: var(--text-primary); font-size: 1.25rem; cursor: pointer; transition: background 0.2s; }
.qty-controls button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
.qty-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
.qty-controls span { width: 50px; text-align: center; font-weight: 600; }
.qty-hint { font-size: 0.8rem; color: #ffc107; }
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
.item-icon { font-size: 2rem; width: 50px; height: 50px; background: var(--bg-card-hover); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.item-info { flex: 1; min-width: 0; }
.item-info h4 { font-size: 0.9rem; font-weight: 500; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-brand { font-size: 0.75rem; color: var(--text-muted); }
.item-qty-stepper { display: flex; align-items: center; background: rgba(255, 255, 255, 0.05); border-radius: 8px; overflow: hidden; }
.item-qty-stepper button { width: 30px; height: 30px; background: transparent; border: none; color: var(--text-primary); font-size: 1rem; cursor: pointer; }
.item-qty-stepper button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
.item-qty-stepper button:disabled { opacity: 0.3; cursor: not-allowed; }
.item-qty-stepper span { width: 34px; text-align: center; font-size: 0.85rem; font-weight: 600; }
.item-price { font-family: 'Space Grotesk', sans-serif; font-weight: 600; color: var(--primary); min-width: 70px; text-align: right; }
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
.checkout-items { display: flex; flex-direction: column; gap: 0.5rem; max-height: 180px; overflow-y: auto; padding-right: 2px; }
.checkout-item { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; }
.ci-icon { font-size: 1.1rem; }
.ci-name { flex: 1; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ci-qty { color: var(--text-muted); }
.ci-price { font-family: 'Space Grotesk', sans-serif; font-weight: 600; color: var(--primary); }
.info-row { display: flex; justify-content: space-between; font-size: 0.9rem; }
.info-row .label { color: var(--text-secondary); }
.info-row .value { font-weight: 500; }
.info-row .value.mono { font-family: monospace; font-size: 0.82rem; }
.info-row.total { border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.25rem; }
.info-row .value.price { font-family: 'Space Grotesk', sans-serif; font-size: 1.25rem; color: var(--primary); }
.info-row .value.surcharge { color: #ffc107; font-weight: 600; }
.amount-notice { background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); color: #ffc107; font-size: 0.8rem; padding: 0.6rem 0.75rem; border-radius: 8px; line-height: 1.5; }
.amount-notice.error { background: rgba(255, 107, 107, 0.1); border-color: rgba(255, 107, 107, 0.3); color: #ff6b6b; }
.fault-simulator { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.25rem; }
.fault-label { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }
.fault-select { flex: 1; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.75rem; color: var(--text-primary); font-size: 0.8rem; cursor: pointer; }
.fault-tip { font-size: 0.72rem; color: var(--text-muted); line-height: 1.5; }
.btn-back, .btn-cancel-order, .btn-pay { padding: 14px 18px; font-size: 0.9rem; font-weight: 600; border-radius: 12px; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; }
.btn-back { flex: 1; background: transparent; border: 1px solid var(--border); color: var(--text-primary); }
.btn-back:hover:not(:disabled) { background: rgba(255, 255, 255, 0.05); border-color: var(--text-muted); }
.btn-cancel-order { flex: 1; background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); color: #ff6b6b; }
.btn-cancel-order:hover:not(:disabled) { background: rgba(255, 107, 107, 0.2); }
.btn-pay { flex: 1.5; background: var(--gradient-1); border: none; color: var(--bg-dark); }
.btn-pay:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 25px var(--primary-glow); }
.btn-pay:disabled, .btn-back:disabled, .btn-cancel-order:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-loading { width: 16px; height: 16px; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: pay-spin 0.8s linear infinite; }
@keyframes pay-spin { to { transform: rotate(360deg); } }
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
.order-status.paid { background: rgba(0, 217, 165, 0.15); color: var(--primary); }
.order-status.pending_payment { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
.order-status.cancelled { background: rgba(140, 140, 150, 0.15); color: #8a8a9a; }
.order-items { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
.order-item { display: flex; align-items: center; gap: 0.4rem; background: rgba(255, 255, 255, 0.05); padding: 0.4rem 0.6rem; border-radius: 8px; font-size: 0.8rem; }
.item-icon { font-size: 1rem; }
.item-name { color: var(--text-secondary); }
.item-qty { color: var(--text-muted); }
.order-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid var(--border); }
.order-time { font-size: 0.75rem; color: var(--text-muted); }
.order-amount { font-family: 'Space Grotesk', sans-serif; font-weight: 700; color: var(--primary); }
.order-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.75rem; }
.order-btn { padding: 0.45rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
.order-btn.primary { background: var(--gradient-1); color: var(--bg-dark); border: none; }
.order-btn.default { background: rgba(255, 255, 255, 0.05); border-color: var(--border); color: var(--text-primary); }
.order-btn.danger { background: rgba(255, 107, 107, 0.1); border-color: rgba(255, 107, 107, 0.3); color: #ff6b6b; }
.orders-empty { padding: 3rem; text-align: center; color: var(--text-muted); }
.orders-empty .empty-icon { font-size: 3rem; margin-bottom: 0.5rem; opacity: 0.5; }
</style>
