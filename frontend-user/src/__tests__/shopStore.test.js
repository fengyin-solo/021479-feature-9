/**
 * 商城购物与支付流程单元测试
 *
 * 覆盖范围：
 * - 购物车数量与库存约束
 * - 多商品整组结算
 * - 库存不足 / 支付中断（网关失败）/ 金额变化 时保留原订单重试
 * - 重复提交（同内容 / 并发 / 已支付再支付）不产生重复订单
 * - 返回商城后继续付款、取消订单不产生重复订单
 * - 支付结果与任务中心（taskStore）一一对应
 * - 分类、排序不受影响（在视图层保持，此处校验目录数据完整）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shopStore, state, products } from '../utils/shopStore'
import { taskStore } from '../utils/taskStore'

// ==================== Mock 设置 ====================

const localStorageMock = {
  store: {},
  getItem: vi.fn(key => (Object.prototype.hasOwnProperty.call(localStorageMock.store, key) ? localStorageMock.store[key] : null)),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = String(value) }),
  removeItem: vi.fn(key => { delete localStorageMock.store[key] }),
  clear: vi.fn(() => { localStorageMock.store = {} })
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock, configurable: true })

// ==================== 测试辅助 ====================

const ids = {
  cue: 1, // LP球杆 库存12
  predator: 2, // 库存5
  ball: 3, // 星牌球 库存20
  chalk: 5, // 巧克粉 库存5
  glove: 7 // 手套 库存30
}

function snapshot(id, qty = 1) {
  const p = shopStore.getProduct(id)
  return { id: p.id, name: p.name, brand: p.brand, icon: p.icon, price: p.price, qty }
}

function cartSnapshot(idQtyList) {
  return idQtyList.map(([id, qty]) => snapshot(id, qty))
}

function orderCount(status) {
  return state.orders.filter(o => (!status || o.status === status)).length
}

// ==================== 测试用例 ====================

describe('Shop Store', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    shopStore.reset()
    taskStore.clearAll()
  })

  // ---------- 库存与购物车 ----------

  describe('库存与购物车', () => {
    it('商品目录包含原有分类与价格数据', () => {
      expect(products.length).toBe(8)
      const categories = new Set(products.map(p => p.category))
      expect(categories).toEqual(new Set(['cue', 'ball', 'accessory', 'clothing']))
    })

    it('初始可用库存等于配置库存', () => {
      expect(shopStore.getAvailableStock(ids.cue)).toBe(12)
      expect(shopStore.getAvailableStock(ids.chalk)).toBe(5)
    })

    it('加入购物车后数量累加、金额正确', () => {
      expect(shopStore.addToCart(ids.cue, 1).ok).toBe(true)
      expect(shopStore.addToCart(ids.cue, 2).ok).toBe(true)
      expect(shopStore.getCartQty(ids.cue)).toBe(3)
      expect(shopStore.getCartCount()).toBe(3)
      expect(shopStore.getCartTotal()).toBe(2999 * 3)
    })

    it('购物车数量不能超过可用库存', () => {
      const result = shopStore.addToCart(ids.chalk, 6)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('库存不足')
      expect(shopStore.getCartQty(ids.chalk)).toBe(0)
    })

    it('setCartQty 超过库存时拒绝调整', () => {
      shopStore.addToCart(ids.chalk, 2)
      const result = shopStore.setCartQty(ids.chalk, 10)
      expect(result.ok).toBe(false)
      expect(shopStore.getCartQty(ids.chalk)).toBe(2)
    })

    it('setCartQty 设为 0 时移除商品', () => {
      shopStore.addToCart(ids.glove, 2)
      expect(shopStore.setCartQty(ids.glove, 0).ok).toBe(true)
      expect(shopStore.getCartQty(ids.glove)).toBe(0)
    })
  })

  // ---------- 多商品整组结算 ----------

  describe('多商品整组结算', () => {
    it('购物车中多种商品一次性结算为同一订单', async () => {
      const items = cartSnapshot([[ids.cue, 1], [ids.ball, 2], [ids.glove, 3]])
      const result = await shopStore.submitCheckout({ items, source: 'cart', fault: 'normal' })

      expect(result.ok).toBe(true)
      expect(result.order.items).toHaveLength(3)
      const expectedAmount = 2999 * 1 + 1299 * 2 + 89 * 3
      expect(result.order.amount).toBe(expectedAmount)
      expect(result.order.status).toBe('paid')
      expect(orderCount('paid')).toBe(1)
    })

    it('支付成功后扣减库存并从购物车移除对应数量', async () => {
      shopStore.addToCart(ids.cue, 2)
      shopStore.addToCart(ids.ball, 1)
      const items = cartSnapshot([[ids.cue, 2], [ids.ball, 1]])
      await shopStore.submitCheckout({ items, source: 'cart' })

      expect(shopStore.getAvailableStock(ids.cue)).toBe(10)
      expect(shopStore.getAvailableStock(ids.ball)).toBe(19)
      expect(shopStore.getCartCount()).toBe(0)
    })

    it('整组结算只扣减已购买的部分，剩余购物车内容保留', async () => {
      shopStore.addToCart(ids.glove, 5)
      // 只结算其中 2 件
      const result = await shopStore.submitCheckout({ items: [snapshot(ids.glove, 2)], source: 'cart' })
      expect(result.ok).toBe(true)
      expect(shopStore.getCartQty(ids.glove)).toBe(3)
    })
  })

  // ---------- 库存不足 ----------

  describe('库存不足', () => {
    it('建单前库存不足时不生成订单', () => {
      // 先占用全部库存
      shopStore.addToCart(ids.chalk, 5)
      const order = shopStore.createPendingOrder([snapshot(ids.chalk, 5)], 'cart')
      expect(order.ok).toBe(true)
      // 第二笔超出库存的结算不能建单
      const second = shopStore.createPendingOrder([snapshot(ids.chalk, 1)], 'buyNow')
      expect(second.ok).toBe(false)
      expect(second.code).toBe('stock')
      expect(orderCount()).toBe(1)
    })

    it('支付时模拟库存不足，订单保留且可重试成功', async () => {
      const items = [snapshot(ids.glove, 2)]
      const first = await shopStore.submitCheckout({ items, source: 'buyNow', fault: 'stock' })
      expect(first.ok).toBe(false)
      expect(first.code).toBe('stock')
      const orderNo = first.order.orderNo
      expect(first.order.status).toBe('pending_payment')
      expect(orderCount()).toBe(1)

      // 切回正常模式重试：同一订单号支付成功
      const retry = await shopStore.submitCheckout({ items, source: 'buyNow', fault: 'normal', orderNo })
      expect(retry.ok).toBe(true)
      expect(retry.order.orderNo).toBe(orderNo)
      expect(retry.order.status).toBe('paid')
      expect(orderCount()).toBe(1)
    })

    it('待付款订单预留库存，取消后释放', () => {
      shopStore.createPendingOrder([snapshot(ids.chalk, 4)], 'cart')
      expect(shopStore.getAvailableStock(ids.chalk)).toBe(1)

      const orderNo = state.orders[0].orderNo
      expect(shopStore.cancelOrder(orderNo).ok).toBe(true)
      expect(shopStore.getAvailableStock(ids.chalk)).toBe(5)
    })
  })

  // ---------- 重复提交 ----------

  describe('重复提交防护', () => {
    it('相同结算内容重复进入结算复用同一待付款订单', () => {
      const items = cartSnapshot([[ids.cue, 1], [ids.ball, 1]])
      const a = shopStore.createPendingOrder(items, 'cart')
      const b = shopStore.createPendingOrder(items, 'cart')
      expect(b.reused).toBe(true)
      expect(b.order.orderNo).toBe(a.order.orderNo)
      expect(orderCount()).toBe(1)
    })

    it('并发支付同一订单时只允许一笔进入', async () => {
      const items = [snapshot(ids.cue, 1)]
      const created = shopStore.createPendingOrder(items, 'cart')
      const orderNo = created.order.orderNo

      const p1 = shopStore.payOrder(orderNo, 'normal')
      const p2 = shopStore.payOrder(orderNo, 'normal')
      const [r1, r2] = await Promise.all([p1, p2])

      expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1)
      expect([r1.code, r2.code]).toContain('in_flight')
      expect(orderCount('paid')).toBe(1)
    })

    it('已支付订单重复支付直接返回成功，不生成第二单', async () => {
      const items = [snapshot(ids.ball, 1)]
      const first = await shopStore.submitCheckout({ items, source: 'buyNow' })
      expect(first.ok).toBe(true)

      const second = await shopStore.payOrder(first.order.orderNo, 'normal')
      expect(second.ok).toBe(true)
      expect(second.duplicated).toBe(true)
      expect(second.order.orderNo).toBe(first.order.orderNo)
      expect(orderCount()).toBe(1)
    })

    it('快速双击确认（submitCheckout 并携带同一 orderNo）只支付一次', async () => {
      const items = [snapshot(ids.cue, 1)]
      const created = shopStore.createPendingOrder(items, 'cart')
      const [r1, r2] = await Promise.all([
        shopStore.submitCheckout({ items, source: 'cart', orderNo: created.order.orderNo }),
        shopStore.submitCheckout({ items, source: 'cart', orderNo: created.order.orderNo })
      ])
      expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1)
      expect(orderCount('paid')).toBe(1)
    })
  })

  // ---------- 金额变化 ----------

  describe('金额变化', () => {
    it('支付时金额变化，保留原订单号并更新金额，重试成功', async () => {
      const items = [snapshot(ids.glove, 1)] // 89
      const first = await shopStore.submitCheckout({ items, source: 'buyNow', fault: 'price' })
      expect(first.ok).toBe(false)
      expect(first.code).toBe('amount_changed')
      const orderNo = first.order.orderNo
      expect(first.order.amount).toBe(189) // 89 + 100 模拟调价
      expect(first.order.status).toBe('pending_payment')
      expect(orderCount()).toBe(1)

      const retry = await shopStore.submitCheckout({ items, source: 'buyNow', fault: 'normal', orderNo })
      expect(retry.ok).toBe(true)
      expect(retry.order.orderNo).toBe(orderNo)
      expect(retry.order.amount).toBe(189)
      expect(orderCount('paid')).toBe(1)
    })

    it('金额变化与库存不足连续出现后仍可重试成功，订单始终只有一个', async () => {
      const items = [snapshot(ids.glove, 1)]
      const r1 = await shopStore.submitCheckout({ items, source: 'buyNow', fault: 'price' })
      expect(r1.code).toBe('amount_changed')

      const r2 = await shopStore.submitCheckout({ items, source: 'buyNow', fault: 'stock', orderNo: r1.order.orderNo })
      expect(r2.code).toBe('stock')
      expect(r2.order.orderNo).toBe(r1.order.orderNo)
      expect(r2.order.status).toBe('pending_payment')

      const r3 = await shopStore.submitCheckout({ items, source: 'buyNow', fault: 'normal', orderNo: r1.order.orderNo })
      expect(r3.ok).toBe(true)
      expect(r3.order.amount).toBe(189)
      expect(orderCount()).toBe(1)
      expect(orderCount('paid')).toBe(1)
    })
  })

  // ---------- 支付中断 / 返回商城 ----------

  describe('支付中断与返回商城', () => {
    it('网关失败后订单内容与数量原样保留，可继续付款', async () => {
      const items = cartSnapshot([[ids.cue, 1], [ids.glove, 2]])
      const first = await shopStore.submitCheckout({ items, source: 'cart', fault: 'gateway' })
      expect(first.ok).toBe(false)
      expect(first.code).toBe('gateway')
      expect(first.order.items).toHaveLength(2)
      expect(first.order.status).toBe('pending_payment')

      const orderNo = first.order.orderNo
      const retry = await shopStore.submitCheckout({ items, source: 'cart', fault: 'normal', orderNo })
      expect(retry.ok).toBe(true)
      expect(retry.order.orderNo).toBe(orderNo)
      expect(orderCount()).toBe(1)
    })

    it('返回商城后用相同购物车内容结算，自动恢复同一待付款订单', async () => {
      const items = cartSnapshot([[ids.ball, 2]])
      const first = await shopStore.submitCheckout({ items, source: 'cart', fault: 'gateway' })
      expect(first.ok).toBe(false)

      // 模拟用户返回商城后再次点「去结算」
      const resume = shopStore.createPendingOrder(items, 'cart')
      expect(resume.reused).toBe(true)
      expect(resume.order.orderNo).toBe(first.order.orderNo)
      expect(orderCount()).toBe(1)
    })

    it('购物车内容被修改后重新结算会生成新订单，不影响原待付款订单', async () => {
      const itemsA = [snapshot(ids.glove, 1)]
      const a = await shopStore.submitCheckout({ items: itemsA, source: 'cart', fault: 'gateway' })
      expect(a.ok).toBe(false)

      const itemsB = [snapshot(ids.glove, 2)]
      const b = shopStore.createPendingOrder(itemsB, 'cart')
      expect(b.order.orderNo).not.toBe(a.order.orderNo)
      expect(orderCount('pending_payment')).toBe(2)
    })
  })

  // ---------- 取消订单 ----------

  describe('取消订单', () => {
    it('取消待付款订单后不能继续支付，且不会产生新订单', async () => {
      const items = [snapshot(ids.cue, 1)]
      const first = await shopStore.submitCheckout({ items, source: 'buyNow', fault: 'gateway' })
      expect(first.ok).toBe(false)
      const orderNo = first.order.orderNo

      expect(shopStore.cancelOrder(orderNo).ok).toBe(true)
      const retry = await shopStore.submitCheckout({ items, source: 'buyNow', orderNo })
      expect(retry.ok).toBe(false)
      expect(retry.code).toBe('cancelled')
      expect(orderCount('cancelled')).toBe(1)
      expect(orderCount('paid')).toBe(0)
    })

    it('已支付订单不能取消', async () => {
      const items = [snapshot(ids.ball, 1)]
      const paid = await shopStore.submitCheckout({ items, source: 'buyNow' })
      const result = shopStore.cancelOrder(paid.order.orderNo)
      expect(result.ok).toBe(false)
      expect(orderCount('paid')).toBe(1)
    })
  })

  // ---------- 任务中心一致性 ----------

  describe('任务中心一致性', () => {
    it('支付成功 / 失败 / 取消，任务中心始终只有一条对应记录且金额状态一致', async () => {
      const items = [snapshot(ids.cue, 2)]
      const pending = await shopStore.submitCheckout({ items, source: 'cart', fault: 'gateway' })
      const orderNo = pending.order.orderNo

      const t1 = taskStore.getByOrderNo(orderNo)
      expect(t1).toBeTruthy()
      expect(t1.status).toBe('pending_payment')
      expect(t1.amount).toBe(5998)

      // 再次 upsert 不应产生重复任务
      taskStore.upsertOrderTask(shopStore.getOrder(orderNo))
      expect(taskStore.getAll().filter(t => t.extra?.orderNo === orderNo)).toHaveLength(1)

      await shopStore.payOrder(orderNo, 'normal')
      const t2 = taskStore.getByOrderNo(orderNo)
      expect(t2.status).toBe('pending_shipment')
      expect(t2.amount).toBe(5998)
      expect(taskStore.getAll().filter(t => t.extra?.orderNo === orderNo)).toHaveLength(1)

      // 已支付不可取消，状态保持
      shopStore.cancelOrder(orderNo)
      expect(taskStore.getByOrderNo(orderNo).status).toBe('pending_shipment')
    })

    it('取消订单同步到任务中心为已取消且不重复', () => {
      const created = shopStore.createPendingOrder([snapshot(ids.glove, 1)], 'cart')
      shopStore.cancelOrder(created.order.orderNo)
      const task = taskStore.getByOrderNo(created.order.orderNo)
      expect(task.status).toBe('cancelled')
      expect(taskStore.getAll().filter(t => t.extra?.orderNo === created.order.orderNo)).toHaveLength(1)
    })
  })

  // ---------- 持久化 ----------

  describe('持久化', () => {
    it('购物车与订单写入 localStorage，中断后可恢复', async () => {
      shopStore.addToCart(ids.ball, 2)
      const created = shopStore.createPendingOrder([snapshot(ids.ball, 2)], 'cart')

      expect(localStorageMock.setItem).toHaveBeenCalledWith('billiard_shop_cart', expect.any(String))
      expect(localStorageMock.setItem).toHaveBeenCalledWith('billiard_shop_orders', expect.any(String))

      // 模拟刷新：重新解析本地数据
      const savedCart = JSON.parse(localStorageMock.store['billiard_shop_cart'])
      const savedOrders = JSON.parse(localStorageMock.store['billiard_shop_orders'])
      expect(savedCart[0].id).toBe(ids.ball)
      expect(savedOrders[0].orderNo).toBe(created.order.orderNo)
      expect(savedOrders[0].status).toBe('pending_payment')
    })
  })
})
