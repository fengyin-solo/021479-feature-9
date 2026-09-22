/**
 * 任务中心存储管理
 * 统一管理预约、报名、订单等任务数据，使用 localStorage 持久化
 */

const STORAGE_KEY = 'billiard_user_tasks'
const logger = {
  info: (...args) => console.log('[taskStore]', ...args),
  warn: (...args) => console.warn('[taskStore]', ...args),
  error: (...args) => console.error('[taskStore]', ...args)
}

const taskTypeConfig = {
  booking: {
    name: '球桌预约',
    icon: '🎱',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/tables' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      upcoming: [
        { key: 'view', label: '查看详情', type: 'primary' },
        { key: 'rebook', label: '再次预约', type: 'default', route: '/tables' }
      ],
      ongoing: [
        { key: 'view', label: '查看详情', type: 'primary' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default' },
        { key: 'rebook', label: '再次预约', type: 'primary', route: '/tables' }
      ]
    }
  },
  course: {
    name: '课程报名',
    icon: '📚',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/courses' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      upcoming: [
        { key: 'view', label: '查看详情', type: 'primary', route: '/courses' }
      ],
      ongoing: [
        { key: 'view', label: '继续学习', type: 'primary', route: '/courses' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default' },
        { key: 'review', label: '评价', type: 'primary' }
      ]
    }
  },
  competition: {
    name: '赛事报名',
    icon: '🏆',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/competitions' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      upcoming: [
        { key: 'view', label: '查看赛程', type: 'primary', route: '/competitions' }
      ],
      ongoing: [
        { key: 'view', label: '观看直播', type: 'primary', route: '/competitions' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default', route: '/competitions' }
      ]
    }
  },
  order: {
    name: '商城订单',
    icon: '🛒',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary' },
        { key: 'cancel', label: '取消订单', type: 'danger' }
      ],
      pending_shipment: [
        { key: 'view', label: '查看订单', type: 'primary' },
        { key: 'remind', label: '提醒发货', type: 'default' }
      ],
      shipped: [
        { key: 'view', label: '查看物流', type: 'primary' },
        { key: 'confirm', label: '确认收货', type: 'primary' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default' },
        { key: 'review', label: '评价', type: 'primary' },
        { key: 'rebuy', label: '再次购买', type: 'default' }
      ],
      cancelled: [
        { key: 'rebuy', label: '再次购买', type: 'primary' }
      ]
    }
  }
}

const statusConfig = {
  pending_payment: { text: '待付款', type: 'warning' },
  upcoming: { text: '待开始', type: 'info' },
  ongoing: { text: '进行中', type: 'primary' },
  pending_shipment: { text: '待发货', type: 'warning' },
  shipped: { text: '已发货', type: 'info' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'danger' }
}

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : getDefaultTasks()
  } catch (e) {
    logger.error('加载任务失败', e)
    return getDefaultTasks()
  }
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    return true
  } catch (e) {
    logger.error('保存任务失败', e)
    return false
  }
}

function getDefaultTasks() {
  const now = Date.now()
  return [
    {
      id: 'T' + now.toString() + '001',
      type: 'booking',
      title: '3号球桌 - 美式九球',
      subtitle: '2026-02-15 14:00 - 16:00',
      amount: 120,
      status: 'pending_payment',
      createdAt: formatDate(new Date(now - 86400000)),
      extra: { tableId: 3, date: '2026-02-15', time: '14:00 - 16:00' }
    },
    {
      id: 'T' + now.toString() + '002',
      type: 'course',
      title: '台球入门基础课',
      subtitle: '报名成功，等待开课',
      amount: 599,
      status: 'upcoming',
      createdAt: formatDate(new Date(now - 259200000)),
      extra: { courseId: 1 }
    },
    {
      id: 'T' + now.toString() + '003',
      type: 'competition',
      title: '周末九球挑战赛',
      subtitle: '比赛进行中',
      amount: 100,
      status: 'ongoing',
      createdAt: formatDate(new Date(now - 432000000)),
      extra: { competitionId: 2 }
    },
    {
      // 待付款订单：下单后商品价格已调整，用于演示「金额变化」时
      // 继续付款会提示金额变动且不会产生重复订单
      id: 'T' + now.toString() + '004',
      type: 'order',
      title: 'Master专业巧克粉',
      subtitle: '订单已创建，等待付款',
      amount: 29,
      status: 'pending_payment',
      createdAt: formatDate(new Date(now - 172800000)),
      extra: {
        orderNo: 'SP26010101',
        items: [
          { id: 5, name: 'Master专业巧克粉', icon: '🧊', brand: 'Master', price: 29, qty: 1 }
        ],
        createTime: formatDate(new Date(now - 172800000)),
        fingerprint: 'seed-pending-5:1',
        snapshot: {
          totalAmount: 29,
          lines: [{ id: 5, price: 29, qty: 1 }]
        }
      }
    },
    {
      id: 'T' + now.toString() + '005',
      type: 'order',
      title: 'LP专业斯诺克球杆',
      subtitle: '已支付，待发货',
      amount: 2999,
      status: 'pending_shipment',
      createdAt: formatDate(new Date(now - 259200000)),
      extra: {
        orderNo: 'SP26010102',
        items: [
          { id: 1, name: 'LP专业斯诺克球杆', icon: '🏏', brand: 'LP', price: 2999, qty: 1 }
        ],
        createTime: formatDate(new Date(now - 259200000))
      }
    }
  ]
}

function formatDate(date) {
  const d = new Date(date)
  const pad = n => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function generateTaskId() {
  return 'T' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
}

function enrichTask(task) {
  const typeInfo = taskTypeConfig[task.type]
  const statusInfo = statusConfig[task.status]
  const actions = typeInfo?.actions?.[task.status] || []

  return {
    ...task,
    typeName: typeInfo?.name || task.type,
    typeIcon: typeInfo?.icon || '📋',
    statusText: statusInfo?.text || task.status,
    statusType: statusInfo?.type || 'info',
    actions: actions
  }
}

export const taskStore = {
  getAll() {
    const tasks = loadTasks()
    return tasks.map(enrichTask).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    )
  },

  getByStatus(status) {
    const tasks = this.getAll()
    if (status === 'pending') {
      return tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    }
    if (status === 'completed') {
      return tasks.filter(t => t.status === 'completed' || t.status === 'cancelled')
    }
    return tasks
  },

  getById(taskId) {
    const tasks = loadTasks()
    const task = tasks.find(t => t.id === taskId)
    return task ? enrichTask(task) : null
  },

  add(taskData) {
    const tasks = loadTasks()
    const newTask = {
      id: generateTaskId(),
      createdAt: formatDate(new Date()),
      ...taskData
    }
    tasks.unshift(newTask)
    saveTasks(tasks)
    logger.info('任务已添加', newTask)
    return enrichTask(newTask)
  },

  update(taskId, updates) {
    const tasks = loadTasks()
    const index = tasks.findIndex(t => t.id === taskId)
    if (index === -1) {
      logger.warn('任务不存在', taskId)
      return null
    }
    tasks[index] = { ...tasks[index], ...updates }
    saveTasks(tasks)
    logger.info('任务已更新', taskId, updates)
    return enrichTask(tasks[index])
  },

  updateStatus(taskId, newStatus) {
    const statusInfo = statusConfig[newStatus]
    if (!statusInfo) {
      logger.error('无效的状态', newStatus)
      return null
    }
    return this.update(taskId, { status: newStatus })
  },

  remove(taskId) {
    const tasks = loadTasks()
    const filtered = tasks.filter(t => t.id !== taskId)
    if (filtered.length === tasks.length) {
      logger.warn('任务不存在，无法删除', taskId)
      return false
    }
    saveTasks(filtered)
    logger.info('任务已删除', taskId)
    return true
  },

  addBookingTask(table, bookingInfo) {
    return this.add({
      type: 'booking',
      title: `${table.name} - ${table.type}`,
      subtitle: `${bookingInfo.date} ${bookingInfo.time}`,
      amount: table.price * bookingInfo.duration,
      status: 'pending_payment',
      extra: {
        tableId: table.id,
        date: bookingInfo.date,
        time: bookingInfo.time,
        duration: bookingInfo.duration,
        orderNo: bookingInfo.orderNo
      }
    })
  },

  addCourseTask(course, enrollInfo) {
    return this.add({
      type: 'course',
      title: course.name,
      subtitle: '报名成功，等待开课',
      amount: course.price,
      status: 'upcoming',
      extra: {
        courseId: course.id,
        orderNo: enrollInfo.orderNo,
        coach: course.coach,
        lessons: course.lessons
      }
    })
  },

  addCompetitionTask(competition, regInfo) {
    return this.add({
      type: 'competition',
      title: competition.name,
      subtitle: competition.status === 'upcoming' ? '等待比赛开始' : '比赛进行中',
      amount: competition.fee,
      status: competition.status === 'upcoming' ? 'upcoming' : 'ongoing',
      extra: {
        competitionId: competition.id,
        regNo: regInfo.regNo,
        playerNo: regInfo.playerNo,
        date: competition.date
      }
    })
  },

  addOrderTask(order) {
    return this.add({
      type: 'order',
      title: order.items.map(i => i.name).join('、'),
      subtitle: '已下单，待发货',
      amount: order.amount,
      status: 'pending_shipment',
      extra: {
        orderNo: order.orderNo,
        items: order.items,
        createTime: order.createTime
      }
    })
  },

  /**
   * 按订单号查找订单任务
   */
  getOrderByOrderNo(orderNo) {
    const tasks = loadTasks()
    const task = tasks.find(t => t.type === 'order' && t.extra?.orderNo === orderNo)
    return task ? enrichTask(task) : null
  },

  /**
   * 按条目指纹查找仍处于待付款的订单（防止重复下单）
   */
  findPendingOrderByFingerprint(fingerprint) {
    if (!fingerprint) return null
    const tasks = loadTasks()
    const task = tasks.find(
      t => t.type === 'order' && t.status === 'pending_payment' && t.extra?.fingerprint === fingerprint
    )
    return task ? enrichTask(task) : null
  },

  /**
   * 获取全部商城订单（最新在前）
   */
  getOrders() {
    return this.getAll().filter(t => t.type === 'order')
  },

  /**
   * 支付成功：订单进入待发货，以支付时的最新金额 / 条目为准
   */
  markOrderPaid(taskId, patch = {}) {
    const tasks = loadTasks()
    const index = tasks.findIndex(t => t.id === taskId)
    if (index === -1) {
      logger.warn('订单不存在', taskId)
      return null
    }
    // 幂等：非待付款状态直接返回当前任务，不重复扣库存、不产生新订单
    if (tasks[index].status !== 'pending_payment') {
      return enrichTask(tasks[index])
    }
    const extra = { ...(tasks[index].extra || {}) }
    if (patch.items) extra.items = patch.items
    if (patch.extraPatch) Object.assign(extra, patch.extraPatch)
    tasks[index] = {
      ...tasks[index],
      status: 'pending_shipment',
      subtitle: '支付成功，待发货',
      ...(patch.amount != null ? { amount: patch.amount } : {}),
      extra
    }
    saveTasks(tasks)
    logger.info('订单支付成功', taskId)
    return enrichTask(tasks[index])
  },

  /**
   * 取消任务（状态置为已取消，保留记录，不产生新数据）
   */
  cancelTask(taskId) {
    return this.update(taskId, {
      status: 'cancelled',
      subtitle: '已取消'
    })
  },

  /**
   * 更新待付款订单的条目与金额（库存不足时调整数量后仍支付同一订单，
   * 不产生重复订单）
   * @param {string} taskId
   * @param {{items: Array, amount: number, fingerprint: string}} patch
   */
  updatePendingOrderItems(taskId, { items, amount, fingerprint }) {
    const tasks = loadTasks()
    const index = tasks.findIndex(t => t.id === taskId)
    if (index === -1) {
      logger.warn('订单不存在，无法更新条目', taskId)
      return null
    }
    if (tasks[index].status !== 'pending_payment') {
      logger.warn('仅待付款订单可调整条目', taskId)
      return null
    }
    const extra = { ...(tasks[index].extra || {}) }
    extra.items = items
    if (fingerprint) extra.fingerprint = fingerprint
    extra.snapshot = {
      totalAmount: amount,
      lines: items.map(i => ({ id: i.id, price: i.price, qty: i.qty }))
    }
    tasks[index] = {
      ...tasks[index],
      title: items.map(i => i.name).join('、'),
      amount,
      extra
    }
    saveTasks(tasks)
    logger.info('订单条目已调整', taskId)
    return enrichTask(tasks[index])
  },

  markAsPaid(taskId) {
    const task = this.getById(taskId)
    if (!task) return null
    
    let newStatus = 'upcoming'
    let newSubtitle = '支付成功'
    
    if (task.type === 'order') {
      newStatus = 'pending_shipment'
      newSubtitle = '支付成功，待发货'
    } else if (task.type === 'course') {
      newSubtitle = '支付成功，等待开课'
    } else if (task.type === 'booking') {
      newSubtitle = '支付成功，等待使用'
    }
    
    return this.update(taskId, { status: newStatus, subtitle: newSubtitle })
  },

  getPendingCount() {
    return this.getByStatus('pending').length
  },

  getCompletedCount() {
    return this.getByStatus('completed').length
  },

  clearAll() {
    saveTasks([])
    logger.info('所有任务已清除')
  }
}

export default taskStore
