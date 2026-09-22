/**
 * 商城领域存储管理
 *
 * 功能说明：
 * - 统一管理商品库存、购物车、订单（待付款 / 已支付 / 已取消）
 * - 购物车与订单使用 localStorage 持久化，支付中断或返回商城后内容不丢失
 * - 同一份购物车内容在任何情况下只会产生一个订单（幂等提交 + 支付中守卫）
 * - 支付前复核库存与金额：库存不足 / 金额变化时保留原订单（订单号不变）供重试
 * - 提供可复现的异常模拟（支付网关失败 / 库存不足 / 金额变化）用于演示与测试
 *
 * 使用方式：
 * import { shopStore } from '@/utils/shopStore'
 * shopStore.addToCart(productId, 2)
 * const result = await shopStore.submitCheckout({ items, source: 'cart', fault: 'normal' })
 */

import { reactive } from 'vue'
import { taskStore } from './taskStore'

// ==================== 常量定义 ====================

const CART_STORAGE_KEY = 'billiard_shop_cart'
const ORDER_STORAGE_KEY = 'billiard_shop_orders'

/**
 * 商品目录及初始库存（Mock 数据）
 * 已支付订单会扣减可用库存；待付款订单会预留库存；取消订单自动释放。
 */
export const products = [
  { id: 1, name: 'LP专业斯诺克球杆', brand: 'LP', price: 2999, originalPrice: 3599, category: 'cue', icon: '🏏', description: '进口白蜡木杆身，专业级配置', sales: 328, stock: 12, hot: true },
  { id: 2, name: 'Predator美式九球杆', brand: 'Predator', price: 4599, category: 'cue', icon: '🏏', description: '碳纤维前节，低偏转技术', sales: 156, stock: 5, new: true },
  { id: 3, name: '星牌比赛用球', brand: '星牌', price: 1299, originalPrice: 1499, category: 'ball', icon: '🎱', description: '国际比赛标准，酚醛树脂材质', sales: 892, stock: 20, hot: true },
  { id: 4, name: 'Aramith水晶球套装', brand: 'Aramith', price: 2199, category: 'ball', icon: '🎱', description: '比利时进口，透明水晶材质', sales: 234, stock: 8 },
  { id: 5, name: 'Master专业巧克粉', brand: 'Master', price: 39, category: 'accessory', icon: '🧊', description: '美国原装进口，防滑效果好', sales: 2341, stock: 5, hot: true },
  { id: 6, name: '球杆延长器', brand: 'Generic', price: 199, originalPrice: 259, category: 'accessory', icon: '🔧', description: '铝合金材质，轻便耐用', sales: 567, stock: 15 },
  { id: 7, name: 'Kamui台球手套', brand: 'Kamui', price: 89, category: 'accessory', icon: '🧤', description: '日本进口，透气舒适', sales: 1234, stock: 30 },
  { id: 8, name: '专业比赛马甲', brand: 'Billiard Pro', price: 299, category: 'clothing', icon: '🎽', description: '修身剪裁，舒适透气', sales: 445, stock: 6, new: true }
]

/** 金额变化模拟：触发后该单固定加价（模拟服务端调价），订单号不变 */
const SIMULATED_SURCHARGE = 100

// ==================== 响应式状态 ====================

export const state = reactive({
  /** 购物车 [{ id, name, brand, icon, price, qty }] */
  cart: [],
  /** 订单列表（含待付款 / 已支付 / 已取消） */
  orders: [],
  /** 当前正在支付的订单号（防重复提交的异步守卫） */
  payingOrderNo: null
})

/** 同步创建守卫，防止两次提交在同一事件循环内重复建单 */
let creatingOrder = false

// ==================== 持久化 ====================

function loadPersisted() {
  try {
    const cartRaw = localStorage.getItem(CART_STORAGE_KEY)
    const ordersRaw = localStorage.getItem(ORDER_STORAGE_KEY)
    state.cart = cartRaw ? JSON.parse(cartRaw) : []
    state.orders = ordersRaw ? JSON.parse(ordersRaw) : []
  } catch (e) {
    console.warn('[shopStore] 加载本地数据失败', e)
    state.cart = []
    state.orders = []
  }
}

function persistCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart))
  } catch (e) {
    console.warn('[shopStore] 保存购物车失败', e)
  }
}

function persistOrders() {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(state.orders))
  } catch (e) {
    console.warn('[shopStore] 保存订单失败', e)
  }
}

loadPersisted()

// ==================== 工具函数 ====================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatTime(date) {
  const d = new Date(date)
  const pad = n => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function generateOrderNo() {
  let orderNo
  do {
    orderNo = 'SP' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10)
  } while (state.orders.some(o => o.orderNo === orderNo))
  return orderNo
}

/**
 * 结算内容指纹：同来源 + 同商品同数量 视为同一笔结算
 * 金额变化不影响指纹，保证调价后重试仍落在原订单上
 */
function buildSignature(items, source) {
  return items
    .map(i => `${i.id}:${i.qty}`)
    .sort()
    .join(',') + `#${source}`
}

/** 按商品目录重算金额（始终以最新商品价格为准） */
function catalogAmount(items) {
  return items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id)
    const price = product ? product.price : item.price
    return sum + price * item.qty
  }, 0)
}

/** 订单当前应付金额（目录价 + 已确认的调价） */
function effectiveAmount(order) {
  return catalogAmount(order.items) + (order.surcharge || 0)
}

// ==================== Store 定义 ====================

export const shopStore = {
  /** 测试 / 演示用：重置全部状态 */
  reset() {
    state.cart = []
    state.orders = []
    state.payingOrderNo = null
    creatingOrder = false
    persistCart()
    persistOrders()
  },

  getProduct(productId) {
    return products.find(p => p.id === productId) || null
  },

  /**
   * 查询商品可用库存
   * = 初始库存 - 已支付订单占用 - 其他待付款订单预留
   * @param {number} productId 商品ID
   * @param {string|null} excludeOrderNo 续付时排除本单自身的预留
   */
  getAvailableStock(productId, excludeOrderNo = null) {
    const product = this.getProduct(productId)
    if (!product) return 0
    const reserved = state.orders.reduce((sum, order) => {
      if (order.status === 'cancelled' || order.orderNo === excludeOrderNo) return sum
      const item = order.items.find(i => i.id === productId)
      return sum + (item ? item.qty : 0)
    }, 0)
    return Math.max(0, product.stock - reserved)
  },

  /** 购物车中某商品数量 */
  getCartQty(productId) {
    return state.cart.find(i => i.id === productId)?.qty || 0
  },

  /**
   * 加入购物车（受库存约束）
   * @returns {{ok: boolean, error?: string}}
   */
  addToCart(productId, qty = 1) {
    const product = this.getProduct(productId)
    if (!product) return { ok: false, error: '商品不存在' }
    const existing = state.cart.find(i => i.id === productId)
    const currentQty = existing ? existing.qty : 0
    const targetQty = currentQty + qty
    if (targetQty > this.getAvailableStock(productId)) {
      return { ok: false, error: `库存不足，仅剩 ${this.getAvailableStock(productId)} 件` }
    }
    if (existing) {
      existing.qty = targetQty
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        icon: product.icon,
        price: product.price,
        qty
      })
    }
    persistCart()
    return { ok: true }
  },

  /** 直接设置购物车商品数量（0 时移除），同样受库存约束 */
  setCartQty(productId, qty) {
    const index = state.cart.findIndex(i => i.id === productId)
    if (index === -1) return { ok: false, error: '购物车中没有该商品' }
    if (qty <= 0) {
      state.cart.splice(index, 1)
      persistCart()
      return { ok: true }
    }
    if (qty > this.getAvailableStock(productId)) {
      return { ok: false, error: `库存不足，仅剩 ${this.getAvailableStock(productId)} 件` }
    }
    state.cart[index].qty = qty
    persistCart()
    return { ok: true }
  },

  removeFromCart(productId) {
    const index = state.cart.findIndex(i => i.id === productId)
    if (index !== -1) {
      state.cart.splice(index, 1)
      persistCart()
    }
  },

  /** 支付成功后，从购物车中扣减已购买的数量（购物车可能只包含本次结算的一部分） */
  deductCart(items) {
    items.forEach(purchased => {
      const index = state.cart.findIndex(i => i.id === purchased.id)
      if (index === -1) return
      const left = state.cart[index].qty - purchased.qty
      if (left <= 0) state.cart.splice(index, 1)
      else state.cart[index].qty = left
    })
    persistCart()
  },

  getCartItems() {
    return state.cart
  },

  getCartCount() {
    return state.cart.reduce((sum, i) => sum + i.qty, 0)
  },

  getCartTotal() {
    return state.cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  },

  getOrder(orderNo) {
    return state.orders.find(o => o.orderNo === orderNo) || null
  },

  getAllOrders() {
    return [...state.orders].sort((a, b) => b.createTimestamp - a.createTimestamp)
  },

  /**
   * 根据结算内容查找已存在的待付款订单（用于「返回商城 / 重复提交」复用同一订单）
   */
  findPendingOrder(items, source) {
    const signature = buildSignature(items, source)
    return state.orders.find(o => o.status === 'pending_payment' && o._signature === signature) || null
  },

  /**
   * 创建待付款订单（幂等：相同结算内容直接复用已有待付款订单）
   * @returns {{ok: boolean, order?: Object, error?: string, code?: string}}
   */
  createPendingOrder(items, source = 'cart') {
    const existed = this.findPendingOrder(items, source)
    if (existed) return { ok: true, order: existed, reused: true }

    if (creatingOrder) {
      return { ok: false, code: 'in_flight', error: '订单提交中，请勿重复操作' }
    }

    // 建单前先做库存校验，库存不足时不产生任何订单
    const shortage = this.checkStock(items, null)
    if (shortage) {
      return { ok: false, code: 'stock', error: shortage.message, shortItems: shortage.items }
    }

    creatingOrder = true
    try {
      const now = Date.now()
      const order = {
        orderNo: generateOrderNo(),
        items: items.map(i => ({
          id: i.id,
          name: i.name,
          brand: i.brand,
          icon: i.icon,
          price: i.price,
          qty: i.qty
        })),
        amount: catalogAmount(items),
        surcharge: 0,
        status: 'pending_payment',
        origin: source,
        createTime: formatTime(now),
        createTimestamp: now,
        paidTime: null,
        attempts: 0,
        _signature: buildSignature(items, source)
      }
      state.orders.unshift(order)
      persistOrders()
      taskStore.upsertOrderTask(order)
      return { ok: true, order, reused: false }
    } finally {
      creatingOrder = false
    }
  },

  /**
   * 库存复核
   * @param {Array} items 本次结算商品
   * @param {string|null} excludeOrderNo 续付时排除本单自身的预留
   * @returns {{message: string, items: Array}|null}
   */
  checkStock(items, excludeOrderNo) {
    const shortItems = []
    items.forEach(item => {
      const available = this.getAvailableStock(item.id, excludeOrderNo)
      if (item.qty > available) {
        const product = this.getProduct(item.id)
        shortItems.push({
          id: item.id,
          name: item.name || product?.name || `商品${item.id}`,
          qty: item.qty,
          available
        })
      }
    })
    if (shortItems.length === 0) return null
    return {
      items: shortItems,
      message: shortItems
        .map(s => `「${s.name}」库存不足（需 ${s.qty} 件，剩 ${s.available} 件）`)
        .join('；')
    }
  },

  /**
   * 支付订单
   * 幂等保证：
   * - 已支付订单重复支付直接返回成功，不产生第二单
   * - 同一订单并发支付直接拦截
   * - 库存不足 / 金额变化 / 网关失败均保留原订单，可原样重试
   *
   * @param {string} orderNo 订单号
   * @param {string} fault normal | gateway | stock | price
   */
  async payOrder(orderNo, fault = 'normal') {
    const order = this.getOrder(orderNo)
    if (!order) return { ok: false, code: 'not_found', error: '订单不存在' }
    if (order.status === 'paid') {
      return { ok: true, order, duplicated: true }
    }
    if (order.status === 'cancelled') {
      return { ok: false, code: 'cancelled', error: '订单已取消，请重新下单' }
    }
    if (state.payingOrderNo) {
      return { ok: false, code: 'in_flight', error: '上一笔支付正在处理中，请勿重复提交' }
    }

    state.payingOrderNo = order.orderNo
    order.attempts += 1
    try {
      // 模拟支付网关耗时
      await delay(800)

      // 1) 库存复核（stock 为演示用强制不足；其余按真实库存计算）
      const shortage = fault === 'stock'
        ? { items: [{ id: order.items[0].id, name: order.items[0].name, qty: order.items[0].qty, available: 0 }], message: `「${order.items[0].name}」库存不足，请调整数量后重试` }
        : this.checkStock(order.items, order.orderNo)
      if (shortage) {
        persistOrders()
        return { ok: false, code: 'stock', order, error: shortage.message, shortItems: shortage.items }
      }

      // 2) 金额复核：库存通过后，再以商品目录最新价格 + 本次调价为准
      if (fault === 'price' && !order.surcharge) {
        order.surcharge = SIMULATED_SURCHARGE
      }
      const latestAmount = effectiveAmount(order)
      if (order.amount !== latestAmount) {
        order.amount = latestAmount
        persistOrders()
        taskStore.upsertOrderTask(order)
        return {
          ok: false,
          code: 'amount_changed',
          order,
          error: `商品金额已变化，最新应付 ¥${latestAmount}，请确认后重新支付`
        }
      }

      // 3) 支付网关结果
      if (fault === 'gateway') {
        persistOrders()
        return { ok: false, code: 'gateway', order, error: '支付网关繁忙，订单已保留，请稍后重试' }
      }

      // 4) 支付成功：订单号不变、状态流转
      order.status = 'paid'
      order.paidTime = formatTime(new Date())
      persistOrders()
      taskStore.upsertOrderTask(order)
      if (order.origin === 'cart') {
        this.deductCart(order.items)
      }
      return { ok: true, order }
    } finally {
      state.payingOrderNo = null
    }
  },

  /**
   * 结算入口：查找 / 复用待付款订单后发起支付
   * @param {Object} payload
   * @param {Array} payload.items 结算商品快照
   * @param {string} payload.source cart | buyNow
   * @param {string} payload.fault normal | gateway | stock | price
   * @param {string|null} payload.orderNo 续付时指定原订单号
   */
  async submitCheckout({ items, source = 'cart', fault = 'normal', orderNo = null }) {
    let order = orderNo ? this.getOrder(orderNo) : null

    if (order && order.status === 'paid') return { ok: true, order, duplicated: true }
    if (order && order.status === 'cancelled') {
      return { ok: false, code: 'cancelled', error: '订单已取消，请重新下单' }
    }
    if (!order || order.status !== 'pending_payment') {
      order = null
      const created = this.createPendingOrder(items, source)
      if (!created.ok) return created
      order = created.order
    }
    return await this.payOrder(order.orderNo, fault)
  },

  /**
   * 取消订单（仅待付款订单可取消，自动释放预留库存）
   * @returns {{ok: boolean, error?: string}}
   */
  cancelOrder(orderNo) {
    const order = this.getOrder(orderNo)
    if (!order) return { ok: false, error: '订单不存在' }
    if (order.status === 'cancelled') return { ok: true, order }
    if (order.status === 'paid') return { ok: false, error: '订单已支付，无法取消' }
    order.status = 'cancelled'
    persistOrders()
    taskStore.upsertOrderTask(order)
    return { ok: true, order }
  }
}

export default shopStore
