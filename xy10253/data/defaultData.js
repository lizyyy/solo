const DEFAULT_DATA = {
    members: [
        {
            id: 'member_1',
            name: '王小明',
            gender: 'male',
            voiceLow: 'C3',
            voiceHigh: 'F4',
            preferredSection: 'section_1',
            standingExperience: '习惯站男高区，靠近指挥',
            isCoreMember: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'member_2',
            name: '李小红',
            gender: 'female',
            voiceLow: 'G3',
            voiceHigh: 'C5',
            preferredSection: 'section_3',
            standingExperience: '需要站前排看谱',
            isCoreMember: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'member_3',
            name: '张大伟',
            gender: 'male',
            voiceLow: 'F2',
            voiceHigh: 'C4',
            preferredSection: 'section_2',
            standingExperience: '低音区有经验',
            isCoreMember: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'member_4',
            name: '赵小丽',
            gender: 'female',
            voiceLow: 'E3',
            voiceHigh: 'A4',
            preferredSection: 'section_4',
            standingExperience: '女中声部经验丰富',
            isCoreMember: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'member_5',
            name: '陈志强',
            gender: 'male',
            voiceLow: 'B2',
            voiceHigh: 'G4',
            preferredSection: 'section_1',
            standingExperience: '',
            isCoreMember: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'member_6',
            name: '刘美华',
            gender: 'female',
            voiceLow: 'A3',
            voiceHigh: 'E5',
            preferredSection: 'section_3',
            standingExperience: '高音区独唱经验',
            isCoreMember: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'member_7',
            name: '周建国',
            gender: 'male',
            voiceLow: 'G2',
            voiceHigh: 'D4',
            preferredSection: 'section_2',
            standingExperience: '习惯站低音区',
            isCoreMember: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'member_8',
            name: '吴静怡',
            gender: 'female',
            voiceLow: 'D3',
            voiceHigh: 'G4',
            preferredSection: 'section_4',
            standingExperience: '',
            isCoreMember: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
    ],
    sections: [
        {
            id: 'section_1',
            name: '男高音',
            shortName: '男高',
            voiceLow: 'C3',
            voiceHigh: 'G4',
            minCapacity: 2,
            maxCapacity: 6,
            priority: 3,
            color: '#e3f2fd',
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'section_2',
            name: '男低音',
            shortName: '男低',
            voiceLow: 'E2',
            voiceHigh: 'F4',
            minCapacity: 2,
            maxCapacity: 6,
            priority: 2,
            color: '#e8f5e9',
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'section_3',
            name: '女高音',
            shortName: '女高',
            voiceLow: 'G3',
            voiceHigh: 'C5',
            minCapacity: 2,
            maxCapacity: 6,
            priority: 3,
            color: '#fce4ec',
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: 'section_4',
            name: '女中音',
            shortName: '女中',
            voiceLow: 'E3',
            voiceHigh: 'A4',
            minCapacity: 2,
            maxCapacity: 6,
            priority: 2,
            color: '#fff3e0',
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
    ],
    attendance: {},
    lastAllocation: null,
    rehearsalDate: new Date().toISOString().split('T')[0]
};

Object.freeze(DEFAULT_DATA);
