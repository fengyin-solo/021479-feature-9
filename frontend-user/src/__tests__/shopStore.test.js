/**
 * 商城购物与支付流程单元测试
 *
 * 覆盖：
 * - 购物车数量受库存限制、持久化、多商品整组结算
 * - 库存不足：加购/结算/支付三个环节均被拦截，内容保留可重试
 * - 重复提交 / 支付中断 / 返回商城 / 取消订单：不会产生重复订单
 * - 金额变化：支付被拦截，按新金额确认后仍只生成同一订单
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { shopStore, ShopError } from '../utils/shopStore'
import { taskStore } from '../utils/taskStore'

const TASKS_KEY = 'billiard_user_tasks'
const PRODUCTS_KEY = 'billiard_shop_products'
const CART_KEY = 'billiard_shop_cart'

function resetState() {
  localStorage.removeItem(TASKS_KEY)
  localStorage.removeItem(PRODUCTS_KEY)
  localStorage.removeItem(CART_KEY)
  localStorage.removeItem('billiard_shop_order_seq')
  shopStore.resetProducts()
  shopStore.clearCart()
}

describe('Shop Store - 购物车与库存', () => {
  beforeEach(() => {
    resetState()
  })

  it('加入购物车数量累加且受库存上限限制', () => {
    // 巧克粉默认库存 2 件
    expect(shopStore.addToCart(5, 1).ok).toBe(true)
    expect(shopStore.addToCart(5, 1).ok).toBe(true)
    const overflow = shopStore.addToCart(5, 1)
    expect(overflow.ok).toBe(false)
    expect(overflow.code).toBe('STOCK_SHORTAGE')
    expect(shopStore.getCartCount()).toBe(2)
  })

  it('售罄商品无法加入购物车', () => {
    // 马甲默认库存 0
    const result = shopStore.addToCart(8, 1)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('STOCK_SHORTAGE')
    expect(shopStore.getCartCount()).toBe(0)
  })

  it('购物车持久化，刷新状态后内容与金额保留（返回商城场景）', () => {
    shopStore.addToCart(5, 2)
    shopStore.addToCart(7, 1)
    // 重新读取（模拟页面重新进入）
    const cart = shopStore.getCart()
    expect(cart).toHaveLength(2)
    expect(shopStore.getCartCount()).toBe(3)
    expect(shopStore.quoteCart().totalAmount).toBe(39 * 2 + 89)
  })

  it('支持多条商品整组结算，报价含数量与总金额', () => {
    shopStore.addToCart(5, 2)
    shopStore.addToCart(7, 3)
    const quote = shopStore.validateCheckout()
    expect(quote.totalQty).toBe(5)
    expect(quote.totalAmount).toBe(39 * 2 + 89 * 3)
    expect(quote.lines).toHaveLength(2)
  })

  it('setCartQty 直接调整数量同样受库存限制', () => {
    shopStore.addToCart(5, 1)
    const result = shopStore.setCartQty(5, 99)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('STOCK_SHORTAGE')
    expect(shopStore.getCart().find(i => i.id === 5).qty).toBe(1)
  })

  it('结算时库存不足抛出错误且购物车内容保留', () => {
    shopStore.addToCart(5, 2)
    // 支付两件后库存清零（模拟外部库存变化）
    const products = shopStore.getProducts()
    const chalk = products.find(p => p.id === 5)
    chalk.stock = 0
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))

    let thrown
    try {
      shopStore.validateCheckout()
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(ShopError)
    expect(thrown.code).toBe('STOCK_SHORTAGE')
    // 内容保留，可减少数量后重试
    expect(shopStore.getCartCount()).toBe(2)
  })
})

describe('Shop Store - 下单与支付幂等', () => {
  beforeEach(() => {
    resetState()
  })

  it('正常下单支付：生成一个订单、扣减库存、累加销量', async () => {
    shopStore.addToCart(5, 2)
    const reserved = shopStore.reserveOrder(taskStore)
    expect(reserved.status).toBe('pending_payment')
    const orderNo = reserved.extra.orderNo

    const paid = await shopStore.payOrder(taskStore, orderNo)
    expect(paid.status).toBe('pending_shipment')
    expect(paid.amount).toBe(78)

    const product = shopStore.getProduct(5)
    expect(product.stock).toBe(0) // 初始 2，买 2
    expect(product.sales).toBe(2341 + 2)

    // 任务中心与订单列表一致
    const order = taskStore.getOrderByOrderNo(orderNo)
    expect(order.status).toBe('pending_shipment')
  })

  it('支付中断后继续付款：复用同一订单，不产生重复订单', async () => {
    shopStore.addToCart(7, 1)
    const reserved = shopStore.reserveOrder(taskStore)
    const orderNo = reserved.extra.orderNo

    // 用户关闭支付（中断），不做任何操作；再次发起结算
    const reservedAgain = shopStore.reserveOrder(taskStore, [{ id: 7, qty: 1 }])
    expect(reservedAgain.extra.orderNo).toBe(orderNo)

    const paid = await shopStore.payOrder(taskStore, orderNo)
    expect(paid.extra.orderNo).toBe(orderNo)

    const orders = taskStore.getOrders().filter(o => o.status === 'pending_shipment')
    const matching = orders.filter(o => o.extra.orderNo === orderNo)
    expect(matching).toHaveLength(1)
  })

  it('重复提交支付（并发）：只扣一次库存、只有一个订单', async () => {
    shopStore.addToCart(3, 2)
    const reserved = shopStore.reserveOrder(taskStore)
    const orderNo = reserved.extra.orderNo
    const stockBefore = shopStore.getProduct(3).stock

    // 同时点击两次「确认支付」
    const [paid1, paid2] = await Promise.all([
      shopStore.payOrder(taskStore, orderNo),
      shopStore.payOrder(taskStore, orderNo)
    ])

    expect(paid1.extra.orderNo).toBe(orderNo)
    expect(paid2.extra.orderNo).toBe(orderNo)
    expect(shopStore.getProduct(3).stock).toBe(stockBefore - 2)

    const allOrders = taskStore.getOrders().filter(o => o.extra.orderNo === orderNo)
    expect(allOrders).toHaveLength(1)
  })

  it('支付成功后再次支付：幂等返回，不重复扣库存', async () => {
    shopStore.addToCart(6, 1)
    const reserved = shopStore.reserveOrder(taskStore)
    const orderNo = reserved.extra.orderNo
    await shopStore.payOrder(taskStore, orderNo)
    const stockAfterFirst = shopStore.getProduct(6).stock

    const again = await shopStore.payOrder(taskStore, orderNo)
    expect(again.status).toBe('pending_shipment')
    expect(shopStore.getProduct(6).stock).toBe(stockAfterFirst)
  })

  it('取消订单后无法支付，且取消操作幂等、不产生新订单', async () => {
    shopStore.addToCart(7, 2)
    const reserved = shopStore.reserveOrder(taskStore)
    const orderNo = reserved.extra.orderNo
    const stockBefore = shopStore.getProduct(7).stock

    shopStore.cancelOrder(taskStore, orderNo)
    // 重复取消不报错、不产生新数据
    const cancelledAgain = shopStore.cancelOrder(taskStore, orderNo)
    expect(cancelledAgain.status).toBe('cancelled')

    await expect(shopStore.payOrder(taskStore, orderNo)).rejects.toMatchObject({
      code: 'ORDER_CANCELLED'
    })

    // 未支付不扣库存
    expect(shopStore.getProduct(7).stock).toBe(stockBefore)
    // 只有这一条订单记录
    expect(taskStore.getOrders().filter(o => o.extra.orderNo === orderNo)).toHaveLength(1)
  })

  it('已支付订单无法取消', async () => {
    shopStore.addToCart(6, 1)
    const reserved = shopStore.reserveOrder(taskStore)
    await shopStore.payOrder(taskStore, reserved.extra.orderNo)
    expect(() => shopStore.cancelOrder(taskStore, reserved.extra.orderNo)).toThrowError(
      /已支付/
    )
  })

  it('支付时库存不足：订单保留待付款，内容不丢失，补货后可重试成功', async () => {
    shopStore.addToCart(5, 2)
    const reserved = shopStore.reserveOrder(taskStore)
    const orderNo = reserved.extra.orderNo

    // 模拟库存被其它渠道占用
    const products = shopStore.getProducts()
    products.find(p => p.id === 5).stock = 1
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))

    await expect(shopStore.payOrder(taskStore, orderNo)).rejects.toMatchObject({
      code: 'STOCK_SHORTAGE'
    })

    // 订单仍是待付款，内容保留
    const pending = taskStore.getOrderByOrderNo(orderNo)
    expect(pending.status).toBe('pending_payment')
    expect(pending.extra.items[0].qty).toBe(2)

    // 补货后重试成功，仍是同一订单
    const restocked = shopStore.getProducts()
    restocked.find(p => p.id === 5).stock = 5
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(restocked))

    const paid = await shopStore.payOrder(taskStore, orderNo)
    expect(paid.status).toBe('pending_shipment')
    expect(paid.extra.orderNo).toBe(orderNo)
  })
})

describe('Shop Store - 金额变化', () => {
  beforeEach(() => {
    resetState()
  })

  it('支付时检测到金额变化会拒绝，确认新金额后同一订单支付成功', async () => {
    shopStore.addToCart(7, 1)
    const reserved = shopStore.reserveOrder(taskStore)
    const orderNo = reserved.extra.orderNo
    const oldAmount = reserved.amount

    // 模拟商品价格调整
    const products = shopStore.getProducts()
    const glove = products.find(p => p.id === 7)
    glove.price = 99
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))

    // 未确认新金额：拒绝支付，订单保留
    const rejection = shopStore.payOrder(taskStore, orderNo)
    await expect(rejection).rejects.toMatchObject({
      code: 'PRICE_CHANGED',
      details: { oldAmount, newAmount: 99 }
    })
    expect(taskStore.getOrderByOrderNo(orderNo).status).toBe('pending_payment')

    // 按新金额支付成功，仍是同一订单号，金额已更新
    const paid = await shopStore.payOrder(taskStore, orderNo, { acceptNewAmount: true })
    expect(paid.extra.orderNo).toBe(orderNo)
    expect(paid.amount).toBe(99)
    expect(taskStore.getOrders().filter(o => o.extra.orderNo === orderNo)).toHaveLength(1)
  })

  it('立即购买与购物车商品相同且未支付时复用待付款订单', async () => {
    // 购物车已有 1 件手套
    shopStore.addToCart(7, 1)
    const fromCart = shopStore.reserveOrder(taskStore, [{ id: 7, qty: 1 }])

    // 立即购买同样 1 件（返回商城再次发起）
    const fromBuyNow = shopStore.reserveOrder(taskStore, [{ id: 7, qty: 1 }])
    expect(fromBuyNow.extra.orderNo).toBe(fromCart.extra.orderNo)
  })

  it('不同条目组合生成不同订单', async () => {
    shopStore.addToCart(7, 1)
    const orderA = shopStore.reserveOrder(taskStore, [{ id: 7, qty: 1 }])
    const orderB = shopStore.reserveOrder(taskStore, [{ id: 6, qty: 1 }])
    expect(orderB.extra.orderNo).not.toBe(orderA.extra.orderNo)
  })
})
