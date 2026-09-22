/**
 * 商城购物与支付状态管理（Mock 持久化）
 *
 * 职责：
 * - 商品库存 / 销量的唯一数据源（localStorage 持久化）
 * - 购物车持久化（跨页面、刷新、返回商城均保留）
 * - 下单、支付、取消的幂等控制（库存不足 / 重复提交 / 金额变化 /
 *   支付中断 / 返回商城 / 取消订单均不会产生重复订单）
 *
 * 订单本身持久化在 taskStore（任务中心为订单的唯一来源），
 * 本模块负责库存扣减、价格与库存校验，避免与 taskStore 形成循环依赖。
 */

const PRODUCTS_KEY = 'billiard_shop_products'
const CART_KEY = 'billiard_shop_cart'

/**
 * 默认商品目录（库存 / 销量为演示 Mock 数据，可被本地持久化数据覆盖）
 */
const DEFAULT_PRODUCTS = [
  { id: 1, name: 'LP专业斯诺克球杆', brand: 'LP', price: 2999, originalPrice: 3599, category: 'cue', icon: '🏏', description: '进口白蜡木杆身，专业级配置', sales: 328, stock: 12, hot: true },
  { id: 2, name: 'Predator美式九球杆', brand: 'Predator', price: 4599, category: 'cue', icon: '🏏', description: '碳纤维前节，低偏转技术', sales: 156, stock: 8, new: true },
  { id: 3, name: '星牌比赛用球', brand: '星牌', price: 1299, originalPrice: 1499, category: 'ball', icon: '🎱', description: '国际比赛标准，酚醛树脂材质', sales: 892, stock: 20, hot: true },
  { id: 4, name: 'Aramith水晶球套装', brand: 'Aramith', price: 2199, category: 'ball', icon: '🎱', description: '比利时进口，透明水晶材质', sales: 234, stock: 15 },
  { id: 5, name: 'Master专业巧克粉', brand: 'Master', price: 39, category: 'accessory', icon: '🧊', description: '美国原装进口，防滑效果好', sales: 2341, stock: 2, hot: true },
  { id: 6, name: '球杆延长器', brand: 'Generic', price: 199, originalPrice: 259, category: 'accessory', icon: '🔧', description: '铝合金材质，轻便耐用', sales: 567, stock: 30 },
  { id: 7, name: 'Kamui台球手套', brand: 'Kamui', price: 89, category: 'accessory', icon: '🧤', description: '日本进口，透气舒适', sales: 1234, stock: 50 },
  { id: 8, name: '专业比赛马甲', brand: 'Billiard Pro', price: 299, category: 'clothing', icon: '🎽', description: '修身剪裁，舒适透气', sales: 445, stock: 0, new: true }
]

// 简单订阅通知（页面状态跨组件刷新，如任务中心支付后库存变化）
const listeners = new Set()
// 支付处理中的订单：进程内并发锁，防止同一订单并发重复扣款
const payingOrders = new Map()
function notify() {
  listeners.forEach(fn => {
    try { fn() } catch (e) { console.error('[shopStore] listener error', e) }
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === PRODUCTS_KEY || e.key === CART_KEY) notify()
  })
}

// ==================== 持久化工具 ====================

function loadProducts() {
  try {
    const stored = localStorage.getItem(PRODUCTS_KEY)
    if (!stored) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS))
      return DEFAULT_PRODUCTS.map(p => ({ ...p }))
    }
    const parsed = JSON.parse(stored)
    // 以默认目录为基准合并，兼容旧数据（无 stock 字段）与新增商品
    return DEFAULT_PRODUCTS.map(def => {
      const saved = parsed.find(p => p.id === def.id)
      return saved ? { ...def, ...saved } : { ...def }
    })
  } catch (e) {
    console.error('[shopStore] 商品数据加载失败', e)
    return DEFAULT_PRODUCTS.map(p => ({ ...p }))
  }
}

function saveProducts(products) {
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))
  } catch (e) {
    console.error('[shopStore] 商品数据保存失败', e)
  }
}

function loadCart() {
  try {
    const stored = localStorage.getItem(CART_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    // 购物车仅保存 id / qty，展示时与最新商品数据合并，
    // 这样商品价格调整后购物车金额自动跟随最新价格
    return parsed
      .filter(item => item && DEFAULT_PRODUCTS.some(p => p.id === item.id))
      .map(item => ({ id: item.id, qty: Math.max(1, parseInt(item.qty, 10) || 1) }))
  } catch (e) {
    console.error('[shopStore] 购物车加载失败', e)
    return []
  }
}

function persistCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart.map(i => ({ id: i.id, qty: i.qty }))))
  } catch (e) {
    console.error('[shopStore] 购物车保存失败', e)
  }
}

function generateOrderNo() {
  const seq = (parseInt(localStorage.getItem('billiard_shop_order_seq') || '0', 10) + 1)
  localStorage.setItem('billiard_shop_order_seq', String(seq))
  return 'SP' + Date.now().toString().slice(-8) + String(seq).padStart(3, '0')
}

// ==================== 校验错误 ====================

export class ShopError extends Error {
  /**
   * @param {string} code - STOCK_SHORTAGE / PRICE_CHANGED / ORDER_NOT_FOUND /
   *                        ORDER_CANCELLED / ALREADY_PAID / EMPTY_CART / ITEM_INVALID
   * @param {string} message
   * @param {Object} [details]
   */
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'ShopError'
    this.code = code
    this.details = details
  }
}

export const shopStore = {
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  // ==================== 商品 ====================

  getProducts() {
    return loadProducts()
  },

  getProduct(id) {
    return loadProducts().find(p => p.id === id) || null
  },

  /** 重置商品数据（测试用） */
  resetProducts() {
    saveProducts(DEFAULT_PRODUCTS.map(p => ({ ...p })))
    notify()
  },

  // ==================== 购物车 ====================

  /**
   * 获取购物车（与最新商品信息合并后的完整条目）
   * @returns {Array<{id:number,name:string,brand:string,icon:string,price:number,stock:number,qty:number}>}
   */
  getCart() {
    const products = loadProducts()
    return loadCart()
      .map(item => {
        const product = products.find(p => p.id === item.id)
        if (!product) return null
        return {
          id: product.id,
          name: product.name,
          brand: product.brand,
          icon: product.icon,
          price: product.price,
          stock: product.stock,
          sales: product.sales,
          qty: item.qty
        }
      })
      .filter(Boolean)
  },

  getCartCount() {
    return loadCart().reduce((sum, item) => sum + item.qty, 0)
  },

  /**
   * 加入购物车，受库存限制
   * @returns {{ok:true, qty:number}|{ok:false, code:string, message:string, stock:number}}
   */
  addToCart(productId, qty = 1) {
    const products = loadProducts()
    const product = products.find(p => p.id === productId)
    if (!product) return { ok: false, code: 'ITEM_INVALID', message: '商品不存在或已下架', stock: 0 }
    if (product.stock <= 0) {
      return { ok: false, code: 'STOCK_SHORTAGE', message: `${product.name} 已售罄`, stock: 0 }
    }
    const cart = loadCart()
    const existing = cart.find(i => i.id === productId)
    const currentQty = existing ? existing.qty : 0
    const wantQty = currentQty + qty
    if (wantQty > product.stock) {
      return {
        ok: false,
        code: 'STOCK_SHORTAGE',
        message: `库存不足，${product.name} 仅剩 ${product.stock} 件`,
        stock: product.stock
      }
    }
    if (existing) existing.qty = wantQty
    else cart.push({ id: productId, qty })
    persistCart(cart)
    notify()
    return { ok: true, qty: wantQty }
  },

  /**
   * 直接设置购物车中某商品数量（0 表示移除），受库存限制
   */
  setCartQty(productId, qty) {
    const products = loadProducts()
    const product = products.find(p => p.id === productId)
    if (!product) return { ok: false, code: 'ITEM_INVALID', message: '商品不存在或已下架', stock: 0 }
    const cart = loadCart()
    const existing = cart.find(i => i.id === productId)
    if (qty <= 0) {
      if (existing) {
        persistCart(cart.filter(i => i.id !== productId))
        notify()
      }
      return { ok: true, qty: 0 }
    }
    if (qty > product.stock) {
      return {
        ok: false,
        code: 'STOCK_SHORTAGE',
        message: `库存不足，${product.name} 仅剩 ${product.stock} 件`,
        stock: product.stock
      }
    }
    if (existing) existing.qty = qty
    else cart.push({ id: productId, qty })
    persistCart(cart)
    notify()
    return { ok: true, qty }
  },

  removeFromCart(productId) {
    const cart = loadCart()
    const next = cart.filter(i => i.id !== productId)
    persistCart(next)
    notify()
  },

  clearCart() {
    persistCart([])
    notify()
  },

  /**
   * 按商品列表覆盖购物车（任务中心「再次购买」使用），
   * 库存不足的条目自动截断到可购数量，不产生重复订单。
   */
  refillCart(items) {
    const products = loadProducts()
    const cart = []
    const skipped = []
    ;(items || []).forEach(item => {
      const product = products.find(p => p.id === item.id)
      if (!product || product.stock <= 0) {
        skipped.push(product ? product.name : `商品${item.id}`)
        return
      }
      cart.push({ id: product.id, qty: Math.min(item.qty || 1, product.stock) })
    })
    persistCart(cart)
    notify()
    return { skipped }
  },

  // ==================== 金额报价 ====================

  /**
   * 以最新商品价格对一组条目报价
   * @param {Array<{id:number, qty:number}>} lines
   * @returns {{lines:Array, totalAmount:number, totalQty:number}}
   */
  quote(lines) {
    const products = loadProducts()
    const resultLines = []
    let totalAmount = 0
    let totalQty = 0
    ;(lines || []).forEach(line => {
      const product = products.find(p => p.id === line.id)
      if (!product) return
      const qty = Math.max(1, parseInt(line.qty, 10) || 1)
      const amount = product.price * qty
      totalAmount += amount
      totalQty += qty
      resultLines.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        icon: product.icon,
        price: product.price,
        stock: product.stock,
        qty,
        amount
      })
    })
    return { lines: resultLines, totalAmount, totalQty }
  },

  /**
   * 购物车最新报价（含库存与金额）
   */
  quoteCart() {
    return this.quote(loadCart())
  },

  // ==================== 下单 / 支付 / 取消 ====================

  /**
   * 预校验结算：校验购物车（或指定条目）非空、商品有效、库存充足。
   * 返回最新报价，不创建订单、不扣库存。
   */
  validateCheckout(lines = null) {
    const source = lines || loadCart()
    if (!source.length) {
      throw new ShopError('EMPTY_CART', '购物车是空的')
    }
    const products = loadProducts()
    source.forEach(line => {
      const product = products.find(p => p.id === line.id)
      if (!product) {
        throw new ShopError('ITEM_INVALID', '商品不存在或已下架')
      }
      if (line.qty > product.stock) {
        throw new ShopError('STOCK_SHORTAGE', `库存不足，${product.name} 仅剩 ${product.stock} 件`, {
          productId: product.id,
          stock: product.stock,
          requested: line.qty
        })
      }
    })
    return this.quote(source)
  },

  /**
   * 创建待支付订单（幂等）。
   * 相同条目指纹（fingerprint）且仍为待付款时复用原订单，
   * 保证「支付中断 / 返回商城 / 重复提交」不会产生重复订单。
   *
   * @param {Object} taskStore - 任务存储（避免循环依赖，由调用方传入）
   * @param {Array<{id:number, qty:number}>} lines
   * @returns {Object} 待付款任务（order 任务）
   */
  reserveOrder(taskStore, lines) {
    const quote = this.validateCheckout(lines)
    const fingerprint = this.fingerprint(quote.lines)
    const existing = taskStore.findPendingOrderByFingerprint(fingerprint)
    if (existing) return existing

    const orderNo = generateOrderNo()
    const now = new Date()
    const createTime = formatDate(now)
    const items = quote.lines.map(l => ({
      id: l.id, name: l.name, icon: l.icon, brand: l.brand,
      price: l.price, qty: l.qty
    }))
    return taskStore.add({
      type: 'order',
      title: items.map(i => i.name).join('、'),
      subtitle: '订单已创建，等待付款',
      amount: quote.totalAmount,
      status: 'pending_payment',
      createdAt: createTime,
      extra: {
        orderNo,
        items,
        createTime,
        fingerprint,
        // 创建订单时的报价快照，用于金额变化检测
        snapshot: {
          totalAmount: quote.totalAmount,
          lines: items.map(i => ({ id: i.id, price: i.price, qty: i.qty }))
        }
      }
    })
  },

  /**
   * 对待付款订单执行支付（幂等）。
   * - 已取消 / 已支付：返回对应订单，不重复扣库存、不产生新订单
   * - 库存不足：抛 STOCK_SHORTAGE，订单保留为待付款，内容不丢失，可重试
   * - 金额变化：默认拒绝并抛 PRICE_CHANGED；接受新金额需显式 acceptNewAmount
   *
   * @param {Object} taskStore
   * @param {string} orderNo
   * @param {{acceptNewAmount?: boolean}} [options]
   */
  async payOrder(taskStore, orderNo, options = {}) {
    // 并发重复提交防护：同一订单支付处理中时复用进行中的支付，
    // 绝不重复扣库存、不产生重复订单
    const inFlight = payingOrders.get(orderNo)
    if (inFlight) return inFlight
    const promise = this._doPayOrder(taskStore, orderNo, options).finally(() => {
      payingOrders.delete(orderNo)
    })
    payingOrders.set(orderNo, promise)
    return promise
  },

  async _doPayOrder(taskStore, orderNo, options = {}) {
    const order = taskStore.getOrderByOrderNo(orderNo)
    if (!order) throw new ShopError('ORDER_NOT_FOUND', '订单不存在')
    // 幂等：已支付 / 已发货 / 已完成等，直接返回，不重复扣款、不产生重复订单
    if (order.status !== 'pending_payment' && order.status !== 'cancelled') {
      return order
    }
    if (order.status === 'cancelled') {
      throw new ShopError('ORDER_CANCELLED', '订单已取消，无法支付')
    }

    const lines = (order.extra?.items || []).map(i => ({ id: i.id, qty: i.qty }))
    const quote = this.quote(lines)
    if (!quote.lines.length) {
      throw new ShopError('ITEM_INVALID', '订单中的商品已下架，无法支付')
    }

    // 金额变化检测（与订单创建时快照比较）
    const snapshotAmount = order.extra?.snapshot?.totalAmount ?? order.amount
    if (quote.totalAmount !== snapshotAmount && !options.acceptNewAmount) {
      throw new ShopError('PRICE_CHANGED', '商品金额发生变化，请确认新的应付金额', {
        oldAmount: snapshotAmount,
        newAmount: quote.totalAmount,
        lines: quote.lines,
        orderNo
      })
    }

    // 库存二次校验（支付时最终确认）
    const shortage = quote.lines.find(l => l.qty > l.stock)
    if (shortage) {
      throw new ShopError('STOCK_SHORTAGE', `库存不足，${shortage.name} 仅剩 ${shortage.stock} 件`, {
        productId: shortage.id,
        stock: shortage.stock,
        requested: shortage.qty
      })
    }

    // 模拟支付网关耗时；重复并发调用会被下面的幂等标记拦截
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 400))

    // 并发重复提交防护：标记支付中后再查一次状态
    const latest = taskStore.getOrderByOrderNo(orderNo)
    if (!latest) throw new ShopError('ORDER_NOT_FOUND', '订单不存在')
    if (latest.status === 'cancelled') {
      throw new ShopError('ORDER_CANCELLED', '订单已取消，无法支付')
    }
    if (latest.status !== 'pending_payment') {
      return latest // 已被另一请求支付成功
    }

    // 扣减库存、累加销量（Mock 数据源）
    const products = loadProducts()
    quote.lines.forEach(line => {
      const product = products.find(p => p.id === line.id)
      product.stock = Math.max(0, product.stock - line.qty)
      product.sales += line.qty
    })
    saveProducts(products)

    const items = quote.lines.map(l => ({
      id: l.id, name: l.name, icon: l.icon, brand: l.brand,
      price: l.price, qty: l.qty
    }))
    const paidOrder = taskStore.markOrderPaid(order.id, {
      amount: quote.totalAmount,
      items,
      extraPatch: {
        snapshot: {
          totalAmount: quote.totalAmount,
          lines: items.map(i => ({ id: i.id, price: i.price, qty: i.qty }))
        }
      }
    })
    notify()
    return paidOrder
  },

  /**
   * 取消订单（幂等）。仅状态变更，不产生新订单；
   * 未支付订单不占用库存，因此无需回补。
   */
  cancelOrder(taskStore, orderNo) {
    const order = taskStore.getOrderByOrderNo(orderNo)
    if (!order) throw new ShopError('ORDER_NOT_FOUND', '订单不存在')
    if (order.status === 'cancelled') return order
    if (order.status !== 'pending_payment') {
      throw new ShopError('ALREADY_PAID', '订单已支付，无法取消')
    }
    return taskStore.cancelTask(order.id)
  },

  /**
   * 调整待付款订单的条目数量（库存不足时按库存修正后仍支付同一订单）
   * @param {Object} taskStore
   * @param {string} orderNo
   * @param {Array<{id:number, qty:number}>} lines
   * @returns {Object} 更新后的订单任务
   */
  adjustPendingOrder(taskStore, orderNo, lines) {
    const order = taskStore.getOrderByOrderNo(orderNo)
    if (!order) throw new ShopError('ORDER_NOT_FOUND', '订单不存在')
    if (order.status !== 'pending_payment') {
      throw new ShopError('ORDER_NOT_PENDING', '仅待付款订单可调整数量')
    }
    const quote = this.quote(lines)
    if (!quote.lines.length) throw new ShopError('EMPTY_CART', '调整后没有可购买的商品')
    const shortage = quote.lines.find(l => l.qty > l.stock)
    if (shortage) {
      throw new ShopError('STOCK_SHORTAGE', `库存不足，${shortage.name} 仅剩 ${shortage.stock} 件`)
    }
    const items = quote.lines.map(l => ({
      id: l.id, name: l.name, icon: l.icon, brand: l.brand,
      price: l.price, qty: l.qty
    }))
    const updated = taskStore.updatePendingOrderItems(order.id, {
      items,
      amount: quote.totalAmount,
      fingerprint: this.fingerprint(quote.lines)
    })
    notify()
    return updated
  },

  /**
   * 条目指纹：排序后的 id:qty 组合，用于待付款订单去重
   */
  fingerprint(lines) {
    return (lines || [])
      .map(l => `${l.id}:${l.qty}`)
      .sort()
      .join('|')
  }
}

function formatDate(date) {
  const pad = n => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default shopStore
