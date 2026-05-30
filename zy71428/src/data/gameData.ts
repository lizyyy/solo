import type { Suspect, Clue } from '../types'

const GUILTY_INDEX: number = 1

export function createSuspects(): Suspect[] {
  const suspects: Suspect[] = [
    {
      id: 'butler',
      name: '管家 陈守一',
      avatar: '🎩',
      description: '在庄园服务30年，近期被发现有大额赌债，动机可疑',
      priorProbability: 0.25,
      currentProbability: 0.25,
      isGuilty: GUILTY_INDEX === 0,
    },
    {
      id: 'maid',
      name: '女仆 林小雨',
      avatar: '🌸',
      description: '新来不到半年，掌管所有房间钥匙，有作案机会',
      priorProbability: 0.20,
      currentProbability: 0.20,
      isGuilty: GUILTY_INDEX === 1,
    },
    {
      id: 'master',
      name: '男主人 赵世昌',
      avatar: '💎',
      description: '遗产唯一继承人，与受害者关系紧张，受益最大',
      priorProbability: 0.30,
      currentProbability: 0.30,
      isGuilty: GUILTY_INDEX === 2,
    },
    {
      id: 'guest',
      name: '访客 王铭远',
      avatar: '🔮',
      description: '受害者的前商业伙伴，因合同纠纷对簿公堂',
      priorProbability: 0.25,
      currentProbability: 0.25,
      isGuilty: GUILTY_INDEX === 3,
    },
  ]
  return suspects
}

export function createClueDeck(): Clue[] {
  return [
    {
      id: 'clue-blood-glove',
      title: '沾血的手套',
      description: '在管家衣柜深处发现一副带有血迹的皮手套，经鉴定与案发现场血型吻合',
      type: 'incriminating',
      likelihoods: {
        butler: 0.80,
        maid: 0.08,
        master: 0.06,
        guest: 0.06,
      },
      relatedClueIds: ['clue-blood-match'],
      consistencyNote: '手套血型与受害者吻合，但管家声称手套是栽赃',
    },
    {
      id: 'clue-will-change',
      title: '遗嘱修改',
      description: '受害者一周前修改遗嘱，男主人成为唯一继承人，原受益人为慈善基金',
      type: 'incriminating',
      likelihoods: {
        butler: 0.08,
        maid: 0.05,
        master: 0.75,
        guest: 0.12,
      },
      relatedClueIds: [],
    },
    {
      id: 'clue-alibi-maid',
      title: '女仆的不在场证明',
      description: '三名仆人证实案发时女仆在厨房准备晚餐，时间线无矛盾',
      type: 'exonerating',
      likelihoods: {
        butler: 0.35,
        maid: 0.03,
        master: 0.35,
        guest: 0.27,
      },
      relatedClueIds: ['clue-alibi-verify'],
      consistencyNote: '在场证明可靠但非铁证，不能完全排除共犯可能',
    },
    {
      id: 'clue-wound-analysis',
      title: '伤口分析报告',
      description: '法医报告指出凶手为左撇子，访客为右撇子，伤口角度不符',
      type: 'exonerating',
      likelihoods: {
        butler: 0.38,
        maid: 0.30,
        master: 0.27,
        guest: 0.05,
      },
      relatedClueIds: [],
    },
    {
      id: 'clue-blurry-cctv',
      title: '模糊监控画面',
      description: '走廊监控拍到人影，身高约170cm，但面部被遮挡无法辨认',
      type: 'neutral',
      likelihoods: {
        butler: 0.30,
        maid: 0.35,
        master: 0.10,
        guest: 0.25,
      },
      relatedClueIds: [],
    },
    {
      id: 'clue-key-copy',
      title: '配钥匙记录',
      description: '门禁系统记录显示，女仆在案发前一周额外配了一把书房钥匙',
      type: 'incriminating',
      likelihoods: {
        butler: 0.12,
        maid: 0.70,
        master: 0.10,
        guest: 0.08,
      },
      relatedClueIds: ['clue-alibi-maid'],
      consistencyNote: '配钥匙行为与不在场证明冲突，女仆嫌疑因证据矛盾暂不归一',
    },
    {
      id: 'clue-phone-record',
      title: '通话记录',
      description: '案发当晚男主人与受害者有过11分钟的通话，通话结束后受害者显得焦虑不安',
      type: 'incriminating',
      likelihoods: {
        butler: 0.15,
        maid: 0.10,
        master: 0.60,
        guest: 0.15,
      },
      relatedClueIds: ['clue-will-change'],
    },
    {
      id: 'clue-shoe-print',
      title: '花园脚印',
      description: '花园泥地发现43码运动鞋印，管家鞋码为43且拥有同款运动鞋',
      type: 'incriminating',
      likelihoods: {
        butler: 0.65,
        maid: 0.10,
        master: 0.15,
        guest: 0.10,
      },
      relatedClueIds: ['clue-blood-glove'],
      consistencyNote: '脚印与手套均指向管家，两条证据存在关联性',
    },
    {
      id: 'clue-insurance',
      title: '高额保险单',
      description: '受害者在男主人建议下购买了巨额人身保险，受益人为男主人',
      type: 'incriminating',
      likelihoods: {
        butler: 0.10,
        maid: 0.05,
        master: 0.72,
        guest: 0.13,
      },
      relatedClueIds: ['clue-will-change', 'clue-phone-record'],
    },
    {
      id: 'clue-motive-guest',
      title: '商业纠纷详情',
      description: '访客因合同违约被判赔偿受害者500万，已提出上诉，情绪激动',
      type: 'incriminating',
      likelihoods: {
        butler: 0.12,
        maid: 0.08,
        master: 0.15,
        guest: 0.65,
      },
      relatedClueIds: [],
    },
    {
      id: 'clue-butler-debt',
      title: '赌债借据',
      description: '管家近期向地下钱庄借了200万赌债，还款期限正是案发当日',
      type: 'incriminating',
      likelihoods: {
        butler: 0.70,
        maid: 0.08,
        master: 0.12,
        guest: 0.10,
      },
      relatedClueIds: [],
    },
    {
      id: 'clue-alibi-verify',
      title: '在场证明核实',
      description: '警方复核女仆不在场证明，厨房监控时间戳与证人证词一致',
      type: 'exonerating',
      likelihoods: {
        butler: 0.38,
        maid: 0.02,
        master: 0.35,
        guest: 0.25,
      },
      relatedClueIds: ['clue-alibi-maid'],
      consistencyNote: '与第一次不在场证明重复，但提供了更强的确证力',
    },
    {
      id: 'clue-blood-match',
      title: 'DNA比对结果',
      description: '手套上血迹DNA与受害者完全匹配，同时检测到微量管家皮肤细胞',
      type: 'incriminating',
      likelihoods: {
        butler: 0.85,
        maid: 0.04,
        master: 0.06,
        guest: 0.05,
      },
      relatedClueIds: ['clue-blood-glove', 'clue-shoe-print'],
    },
  ]
}

export function shuffleDeck<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
