/**
 * Shop.vue 组件集成测试
 *
 * 覆盖 UI 层面：
 * - 分类筛选 / 排序 / 详情体验保持可用
 * - 多商品整组结算后商品页、成功弹窗、任务中心三处数据一致
 * - 库存不足 / 重复点击不会产生重复订单
 * - 支付失败后内容保留可重试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import Shop from '../views/Shop.vue'
import { shopStore } from '../utils/shopStore'
import { taskStore } from '../utils/taskStore'
import { authState } from '../utils/auth'

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

async function mountShop(query = {}) {
  const route = reactive({ path: '/shop', query })
  const wrapper = mount(Shop, {
    global: {
      mocks: {
        $router: {
          push: vi.fn(),
          replace: vi.fn(() => {
            route.query = {}
            return Promise.resolve()
          })
        },
        $route: route
      }
    }
  })
  await nextTick()
  return wrapper
}

describe('Shop.vue 集成', () => {
  beforeEach(() => {
    resetState()
    // 绕过登录检查
    authState.isLoggedIn = true
    authState.token = 'test-token'
  })

  it('商品页展示库存、分类计数与排序保持可用', async () => {
    const wrapper = await mountShop()
    // 8 件商品
    expect(wrapper.findAll('.product-card')).toHaveLength(8)
    // 库存信息展示
    expect(wrapper.text()).toContain('库存')
    // 售罄徽标（马甲 stock=0）
    expect(wrapper.text()).toContain('已售罄')

    // 切换分类
    wrapper.vm.selectedCategory = 'cue'
    await nextTick()
    expect(wrapper.findAll('.product-card')).toHaveLength(2)

    // 排序
    wrapper.vm.selectedCategory = 'all'
    wrapper.vm.sortBy = 'price-asc'
    await nextTick()
    const prices = wrapper.vm.sortedProducts.map(p => p.price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
  })

  it('多商品整组结算：商品页数量金额、成功结果、任务中心订单一致', async () => {
    const wrapper = await mountShop()

    // 加入两件不同商品
    wrapper.vm.applyAddToCart({ id: 5 }, 2) // 巧克粉 ¥39 x2
    wrapper.vm.applyAddToCart({ id: 7 }, 1) // 手套 ¥89 x1

    expect(wrapper.vm.cartCount).toBe(3)
    expect(wrapper.vm.cartQuote.totalAmount).toBe(39 * 2 + 89)

    // 整组结算
    wrapper.vm.startCheckout()
    expect(wrapper.vm.checkoutView.quote.totalQty).toBe(3)
    expect(wrapper.vm.showCheckoutModal).toBe(true)

    // 确认支付
    await wrapper.vm.confirmCheckout()
    await flushPromises()

    expect(wrapper.vm.showSuccessModal).toBe(true)
    expect(wrapper.vm.orderResult.totalQty).toBe(3)
    expect(wrapper.vm.orderResult.amount).toBe(39 * 2 + 89)

    // 购物车已清空（整组购物车结算）
    expect(shopStore.getCartCount()).toBe(0)

    // 任务中心订单一致
    const order = taskStore.getOrderByOrderNo(wrapper.vm.orderResult.orderNo)
    expect(order.status).toBe('pending_shipment')
    expect(order.amount).toBe(39 * 2 + 89)
    expect(order.extra.items).toHaveLength(2)
  })

  it('库存不足时支付失败，提示保留内容，调整后重试成功且只有一个订单', async () => {
    const wrapper = await mountShop()
    shopStore.addToCart(5, 2) // 库存仅 2

    // 下单（待付款）
    const reserved = shopStore.reserveOrder(taskStore, [{ id: 5, qty: 2 }])

    // 模拟库存被占用为 1
    const products = shopStore.getProducts()
    products.find(p => p.id === 5).stock = 1
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))

    // 从任务中心继续付款
    wrapper.vm.resumeOrder(reserved)
    expect(wrapper.vm.checkoutView.stockError).toContain('库存不足')

    // 直接支付应失败，弹窗内容保留
    await wrapper.vm.confirmCheckout()
    expect(wrapper.vm.showCheckoutModal).toBe(true)
    expect(wrapper.vm.checkoutView.quote.lines[0].qty).toBe(2)

    // 按库存调整数量（仍是同一订单）
    wrapper.vm.adjustToStock()
    expect(wrapper.vm.checkoutView.stockError).toBe('')
    expect(wrapper.vm.checkoutView.quote.lines[0].qty).toBe(1)
    expect(wrapper.vm.checkoutView.resumeOrderNo).toBe(reserved.extra.orderNo)

    // 重试支付成功，订单号不变
    await wrapper.vm.confirmCheckout()
    await flushPromises()
    expect(wrapper.vm.showSuccessModal).toBe(true)
    expect(wrapper.vm.orderResult.orderNo).toBe(reserved.extra.orderNo)

    // 只有一笔订单、已支付
    const all = taskStore.getOrders().filter(o => o.extra.orderNo === reserved.extra.orderNo)
    expect(all).toHaveLength(1)
    expect(all[0].status).toBe('pending_shipment')
    expect(all[0].amount).toBe(39)
  })

  it('取消订单不会生成重复订单，取消后任务中心保留已取消记录', async () => {
    const wrapper = await mountShop()
    shopStore.addToCart(7, 1)
    const reserved = shopStore.reserveOrder(taskStore)

    wrapper.vm.cancelTargetOrder = reserved
    await wrapper.vm.confirmCancelOrder()

    const order = taskStore.getOrderByOrderNo(reserved.extra.orderNo)
    expect(order.status).toBe('cancelled')
    // 仍只有一条记录
    expect(taskStore.getOrders().filter(o => o.extra.orderNo === reserved.extra.orderNo)).toHaveLength(1)
  })

  it('金额变化时需显式确认新金额，支付后仍为同一订单', async () => {
    const wrapper = await mountShop()
    shopStore.addToCart(7, 1)
    const reserved = shopStore.reserveOrder(taskStore)

    // 调价
    const products = shopStore.getProducts()
    products.find(p => p.id === 7).price = 109
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))

    wrapper.vm.resumeOrder(reserved)
    expect(wrapper.vm.checkoutView.priceChanged).toBe(true)

    // 未勾选确认：支付被拦截
    await wrapper.vm.confirmCheckout()
    expect(wrapper.vm.showSuccessModal).toBe(false)

    // 勾选后成功
    wrapper.vm.checkoutView.acceptNewAmount = true
    await wrapper.vm.confirmCheckout()
    await flushPromises()
    expect(wrapper.vm.showSuccessModal).toBe(true)
    expect(wrapper.vm.orderResult.orderNo).toBe(reserved.extra.orderNo)
    expect(wrapper.vm.orderResult.amount).toBe(109)
  })
})
