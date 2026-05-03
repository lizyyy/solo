import { Project, Room, Box, Item, BoxStatus, SystemTagLabels } from '@/models/types'
import { v4 as uuidv4 } from 'uuid'

export function createDemoProject() {
  const sourceRooms = [
    new Room({ name: '客厅', isSource: true, order: 1 }),
    new Room({ name: '主卧', isSource: true, order: 2 }),
    new Room({ name: '次卧', isSource: true, order: 3 }),
    new Room({ name: '书房', isSource: true, order: 4 }),
    new Room({ name: '厨房', isSource: true, order: 5 }),
    new Room({ name: '卫生间', isSource: true, order: 6 })
  ]
  
  const targetRooms = [
    new Room({ name: '新客厅', isSource: false, order: 1 }),
    new Room({ name: '新主卧', isSource: false, order: 2 }),
    new Room({ name: '新次卧', isSource: false, order: 3 }),
    new Room({ name: '新书房', isSource: false, order: 4 })
  ]
  
  const rooms = [...sourceRooms, ...targetRooms]
  
  const boxes = [
    new Box({
      id: uuidv4(),
      boxNumber: '1',
      name: '客厅日用品',
      status: BoxStatus.PACKED,
      targetRoomId: targetRooms[0].id,
      responsiblePerson: '张三',
      maxWeight: 20,
      maxItems: 20
    }),
    new Box({
      id: uuidv4(),
      boxNumber: '2',
      name: '卧室衣物',
      status: BoxStatus.PENDING,
      targetRoomId: targetRooms[1].id,
      responsiblePerson: '李四',
      maxWeight: 20,
      maxItems: 20
    }),
    new Box({
      id: uuidv4(),
      boxNumber: '3',
      name: '书房书籍',
      status: BoxStatus.PENDING,
      targetRoomId: targetRooms[3].id,
      responsiblePerson: '张三',
      maxWeight: 25,
      maxItems: 30
    }),
    new Box({
      id: uuidv4(),
      boxNumber: '4',
      name: '厨房餐具',
      status: BoxStatus.MOVED,
      targetRoomId: targetRooms[0].id,
      responsiblePerson: '李四',
      maxWeight: 15,
      maxItems: 15
    }),
    new Box({
      id: uuidv4(),
      boxNumber: '5',
      name: '重要文件',
      status: BoxStatus.PENDING,
      targetRoomId: targetRooms[3].id,
      responsiblePerson: '张三',
      maxWeight: 5,
      maxItems: 10
    })
  ]
  
  const items = [
    new Item({
      name: '液晶电视',
      quantity: 1,
      weight: 15,
      roomId: sourceRooms[0].id,
      boxId: boxes[0].id,
      tags: [SystemTagLabels.fragile, SystemTagLabels.valuable],
      responsiblePerson: '张三',
      description: '55寸液晶电视，原包装',
      cushioningNote: ''
    }),
    new Item({
      name: '沙发靠垫',
      quantity: 4,
      weight: 2,
      roomId: sourceRooms[0].id,
      boxId: boxes[0].id,
      tags: [],
      responsiblePerson: '李四',
      description: '布艺沙发靠垫'
    }),
    new Item({
      name: '陶瓷花瓶',
      quantity: 2,
      weight: 3,
      roomId: sourceRooms[0].id,
      boxId: boxes[0].id,
      tags: [SystemTagLabels.fragile],
      responsiblePerson: '张三',
      description: '客厅装饰用花瓶',
      cushioningNote: ''
    }),
    new Item({
      name: '冬季大衣',
      quantity: 8,
      weight: 6,
      roomId: sourceRooms[1].id,
      boxId: boxes[1].id,
      tags: [],
      responsiblePerson: '李四',
      description: '羽绒服、呢大衣等'
    }),
    new Item({
      name: '床上用品四件套',
      quantity: 3,
      weight: 4,
      roomId: sourceRooms[1].id,
      boxId: boxes[1].id,
      tags: [],
      responsiblePerson: '李四'
    }),
    new Item({
      name: '编程书籍',
      quantity: 20,
      weight: 18,
      roomId: sourceRooms[3].id,
      boxId: boxes[2].id,
      tags: [],
      responsiblePerson: '张三',
      description: '各种技术书籍'
    }),
    new Item({
      name: '笔记本电脑',
      quantity: 2,
      weight: 3,
      roomId: sourceRooms[3].id,
      boxId: boxes[2].id,
      tags: [SystemTagLabels.fragile, SystemTagLabels.valuable, SystemTagLabels.urgent],
      responsiblePerson: '张三',
      description: '工作用笔记本电脑',
      cushioningNote: '使用原包装，注意防震'
    }),
    new Item({
      name: '陶瓷餐具套装',
      quantity: 1,
      weight: 5,
      roomId: sourceRooms[4].id,
      boxId: boxes[3].id,
      tags: [SystemTagLabels.fragile],
      responsiblePerson: '李四',
      description: '整套陶瓷餐具',
      cushioningNote: ''
    }),
    new Item({
      name: '锅具套装',
      quantity: 1,
      weight: 8,
      roomId: sourceRooms[4].id,
      boxId: boxes[3].id,
      tags: [],
      responsiblePerson: '李四',
      description: '炒锅、汤锅等'
    }),
    new Item({
      name: '房产证',
      quantity: 1,
      weight: 0.1,
      roomId: sourceRooms[3].id,
      boxId: boxes[4].id,
      tags: [SystemTagLabels.document, SystemTagLabels.valuable],
      responsiblePerson: '张三',
      description: '房屋所有权证'
    }),
    new Item({
      name: '身份证户口本',
      quantity: 1,
      weight: 0.1,
      roomId: sourceRooms[3].id,
      boxId: boxes[4].id,
      tags: [SystemTagLabels.document, SystemTagLabels.urgent],
      responsiblePerson: '张三',
      description: '全家身份证、户口本原件'
    }),
    new Item({
      name: '银行存折',
      quantity: 1,
      weight: 0.1,
      roomId: sourceRooms[3].id,
      boxId: null,
      tags: [SystemTagLabels.document, SystemTagLabels.valuable],
      responsiblePerson: '张三',
      description: '各类银行存折、存单'
    }),
    new Item({
      name: '换洗衣物',
      quantity: 5,
      weight: 3,
      roomId: sourceRooms[1].id,
      boxId: null,
      tags: [SystemTagLabels.urgent],
      responsiblePerson: '李四',
      description: '今晚和明天需要换的衣物'
    })
  ]
  
  const project = new Project({
    name: '2024年家庭搬家',
    description: '从老房子搬到新家的搬家项目',
    moveDate: '2024-12-20',
    rooms,
    boxes,
    items
  })
  
  return project
}
