App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    userId: null
  },

  onLaunch: function () {
    this.checkLoginStatus();
    this.initMockData();
  },

  checkLoginStatus: function () {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
      this.globalData.userId = userInfo.id;
    }
  },

  initMockData: function () {
    if (!wx.getStorageSync('isDataInitialized')) {
      const mockData = {
        treeHolePosts: [
          {
            id: 1,
            content: "高考失利了，感觉天都塌下来了。平时模拟考试都能上一本线，这次居然连二本都没到。不敢告诉父母，更不敢面对亲戚的询问。每天躲在房间里，不知道未来该怎么办。",
            createTime: "2026-04-28 15:30",
            commentCount: 5,
            isAnonymous: true
          },
          {
            id: 2,
            content: "复读还是专科？这个问题我想了无数遍。复读怕压力太大，明年考得更差；读专科又不甘心，觉得自己就这样了。好迷茫，谁能告诉我该怎么办？",
            createTime: "2026-04-27 09:15",
            commentCount: 8,
            isAnonymous: true
          },
          {
            id: 3,
            content: "最害怕的是亲戚朋友的眼光。平时他们都觉得我是好孩子，成绩不错，现在突然考砸了，感觉所有人都在背后议论我。出门都怕遇到熟人。",
            createTime: "2026-04-26 20:45",
            commentCount: 12,
            isAnonymous: true
          }
        ],
        anxietyTests: [
          {
            id: 1,
            question: "最近一周，你是否经常感到紧张、焦虑或急切？",
            options: [
              { value: 0, label: "完全没有" },
              { value: 1, label: "几天" },
              { value: 2, label: "一半以上天数" },
              { value: 3, label: "几乎每天" }
            ]
          },
          {
            id: 2,
            question: "你是否经常对未来感到担忧？",
            options: [
              { value: 0, label: "完全没有" },
              { value: 1, label: "几天" },
              { value: 2, label: "一半以上天数" },
              { value: 3, label: "几乎每天" }
            ]
          },
          {
            id: 3,
            question: "你是否容易感到心烦意乱或坐立不安？",
            options: [
              { value: 0, label: "完全没有" },
              { value: 1, label: "几天" },
              { value: 2, label: "一半以上天数" },
              { value: 3, label: "几乎每天" }
            ]
          },
          {
            id: 4,
            question: "你是否经常感到疲劳或精力不足？",
            options: [
              { value: 0, label: "完全没有" },
              { value: 1, label: "几天" },
              { value: 2, label: "一半以上天数" },
              { value: 3, label: "几乎每天" }
            ]
          },
          {
            id: 5,
            question: "你是否难以集中注意力，或者脑子一片空白？",
            options: [
              { value: 0, label: "完全没有" },
              { value: 1, label: "几天" },
              { value: 2, label: "一半以上天数" },
              { value: 3, label: "几乎每天" }
            ]
          },
          {
            id: 6,
            question: "你是否容易被激怒或变得烦躁？",
            options: [
              { value: 0, label: "完全没有" },
              { value: 1, label: "几天" },
              { value: 2, label: "一半以上天数" },
              { value: 3, label: "几乎每天" }
            ]
          },
          {
            id: 7,
            question: "你是否感到害怕，好像会发生什么可怕的事情？",
            options: [
              { value: 0, label: "完全没有" },
              { value: 1, label: "几天" },
              { value: 2, label: "一半以上天数" },
              { value: 3, label: "几乎每天" }
            ]
          }
        ],
        complaints: [
          {
            id: 1,
            title: "亲戚的"关心"真的让人窒息",
            content: "高考成绩出来后，七大姑八大姨轮番"关心"。"考多少分啊？""能上什么大学啊？""邻居家孩子考了600多分呢！"真的很烦，考不好又不是我的错，为什么要反复戳我痛处？",
            category: "亲戚",
            createTime: "2026-04-28 14:20",
            likeCount: 23,
            commentCount: 8
          },
          {
            id: 2,
            title: "学历焦虑真的毁了我",
            content: "从小到大，父母和老师都告诉我"学历决定一切"。现在高考失利了，我真的觉得自己的人生完蛋了。读专科丢人，复读又怕失败。这种焦虑感快把我逼疯了。",
            category: "学历焦虑",
            createTime: "2026-04-27 18:45",
            likeCount: 45,
            commentCount: 15
          },
          {
            id: 3,
            title: "父母的期望让我喘不过气",
            content: "父母为我付出了很多，我也一直很努力。但这次高考失利，我觉得自己辜负了他们的期望。看着他们失望的眼神，我真的很愧疚。不敢告诉他们我想复读，怕他们说我浪费时间。",
            category: "家庭",
            createTime: "2026-04-26 22:10",
            likeCount: 38,
            commentCount: 12
          }
        ],
        pushContents: [
          {
            id: 1,
            type: "同龄人经历",
            title: "高考失利后，我选择了另一条路",
            content: "我去年高考失利，比模拟考试低了近100分。那段时间我把自己关在房间里，不敢见任何人。后来我选择了复读，虽然压力很大，但我知道这是我想要的。今年我考上了理想的大学，想告诉大家：一次考试不代表一生。",
            author: "匿名用户",
            createTime: "2026-04-28 22:00"
          },
          {
            id: 2,
            type: "清醒文案",
            title: "高考只是人生的一个节点",
            content: "高考失利不是世界末日，它只是人生中的一个节点。你可以选择复读，可以选择专科，可以选择职业教育，甚至可以选择gap year。重要的是，你要知道自己想要什么，然后为之努力。",
            author: "系统",
            createTime: "2026-04-27 22:00"
          },
          {
            id: 3,
            type: "解压短句",
            title: "给自己一个拥抱",
            content: "亲爱的，你已经很努力了。高考失利不是你的错，人生还有很多可能性。现在，请给自己一个拥抱，告诉自己：我值得被爱，我有能力创造美好的未来。",
            author: "系统",
            createTime: "2026-04-26 22:00"
          }
        ],
        moments: [
          {
            id: 1,
            userId: 1,
            userName: "阳光总在风雨后",
            avatar: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20cartoon%20avatar%20young%20person%20smiling&image_size=square",
            content: "今天终于鼓起勇气告诉父母我想复读的想法。没想到他们不仅没有反对，还说会一直支持我。原来最害怕的事情，说出来反而轻松了很多。感谢父母的理解和支持！",
            isPublic: true,
            createTime: "2026-04-28 16:30",
            likeCount: 15,
            commentCount: 5,
            comments: [
              {
                id: 1,
                userId: 2,
                userName: "明天会更好",
                content: "加油！有家人的支持就什么都不怕了！",
                createTime: "2026-04-28 17:00"
              }
            ]
          },
          {
            id: 2,
            userId: 2,
            userName: "明天会更好",
            avatar: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20cartoon%20avatar%20young%20person%20peaceful&image_size=square",
            content: "今天去看了专科学校，环境还不错，专业也很感兴趣。突然觉得，读专科也不一定是坏事，只要自己努力，未来一样可以很精彩。",
            isPublic: true,
            createTime: "2026-04-27 14:20",
            likeCount: 20,
            commentCount: 8,
            comments: []
          }
        ],
        users: [
          {
            id: 1,
            userName: "阳光总在风雨后",
            avatar: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20cartoon%20avatar%20young%20person%20smiling&image_size=square",
            createTime: "2026-04-01",
            posts: 5,
            friends: 3,
            followers: 10
          },
          {
            id: 2,
            userName: "明天会更好",
            avatar: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=simple%20cartoon%20avatar%20young%20person%20peaceful&image_size=square",
            createTime: "2026-04-05",
            posts: 3,
            friends: 5,
            followers: 15
          }
        ]
      };

      wx.setStorageSync('treeHolePosts', mockData.treeHolePosts);
      wx.setStorageSync('anxietyTests', mockData.anxietyTests);
      wx.setStorageSync('complaints', mockData.complaints);
      wx.setStorageSync('pushContents', mockData.pushContents);
      wx.setStorageSync('moments', mockData.moments);
      wx.setStorageSync('users', mockData.users);
      wx.setStorageSync('isDataInitialized', true);
    }
  }
});
