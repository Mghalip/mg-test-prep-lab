'use strict';
// Selected order from the verified 2026-10-27 subject practice plan.
const MockPlans=Object.freeze({
  "rw": [
    {
      "order": 1,
      "stage": "基础巩固",
      "id": "A12",
      "focus": "主旨、文本证据与常规语法"
    },
    {
      "order": 2,
      "stage": "基础巩固",
      "id": "A22",
      "focus": "证据选择与诗歌引用"
    },
    {
      "order": 3,
      "stage": "基础巩固",
      "id": "A26",
      "focus": "研究方法与推断边界"
    },
    {
      "order": 4,
      "stage": "基础巩固",
      "id": "A21",
      "focus": "实验支持与长句结构"
    },
    {
      "order": 5,
      "stage": "基础巩固",
      "id": "A20",
      "focus": "历史证据来源与文学论证"
    },
    {
      "order": 6,
      "stage": "进阶强化",
      "id": "A55",
      "focus": "篇章结构与跨领域说明"
    },
    {
      "order": 7,
      "stage": "进阶强化",
      "id": "A35",
      "focus": "数据论证及复杂生命周期推断"
    },
    {
      "order": 8,
      "stage": "进阶强化",
      "id": "A17",
      "focus": "机制比较与多变量科学论证"
    },
    {
      "order": 9,
      "stage": "进阶强化",
      "id": "A19",
      "focus": "代理指标、削弱与研究结论"
    },
    {
      "order": 10,
      "stage": "进阶强化",
      "id": "A18",
      "focus": "空间分辨率与考古证据推断"
    },
    {
      "order": 11,
      "stage": "高难冲刺",
      "id": "A49",
      "focus": "历史证据、图表及限定条件"
    },
    {
      "order": 12,
      "stage": "高难冲刺",
      "id": "A29",
      "focus": "讽刺语气、代理指标与元分析"
    },
    {
      "order": 13,
      "stage": "高难冲刺",
      "id": "A43",
      "focus": "文本评价及图表综合推断"
    },
    {
      "order": 14,
      "stage": "高难冲刺",
      "id": "A46",
      "focus": "抽样、心理与生理效应区分"
    },
    {
      "order": 15,
      "stage": "高难冲刺",
      "id": "A47",
      "focus": "关税情境、代理证据与长句嵌套"
    }
  ],
  "math": [
    {
      "order": 1,
      "stage": "基础强化",
      "id": "A52",
      "focus": "判别式、混合比例及因式结构"
    },
    {
      "order": 2,
      "stage": "基础强化",
      "id": "A48",
      "focus": "增长、相似及方程根"
    },
    {
      "order": 3,
      "stage": "基础强化",
      "id": "A49",
      "focus": "函数及参数表达"
    },
    {
      "order": 4,
      "stage": "基础强化",
      "id": "A46",
      "focus": "二次函数建模与参数范围"
    },
    {
      "order": 5,
      "stage": "基础强化",
      "id": "A36",
      "focus": "增长模型、指数及单位换算"
    },
    {
      "order": 6,
      "stage": "难题进阶",
      "id": "A27",
      "focus": "指数步长、几何及判别式"
    },
    {
      "order": 7,
      "stage": "难题进阶",
      "id": "A53",
      "focus": "指数、分式及三角关系"
    },
    {
      "order": 8,
      "stage": "难题进阶",
      "id": "A37",
      "focus": "相似体积、指数参数及根的和"
    },
    {
      "order": 9,
      "stage": "难题进阶",
      "id": "A30",
      "focus": "代数恒等关系与几何综合"
    },
    {
      "order": 10,
      "stage": "难题进阶",
      "id": "A29",
      "focus": "函数表示、分式及圆几何"
    },
    {
      "order": 11,
      "stage": "高难冲刺",
      "id": "A32",
      "focus": "整数约束、判别式及分式解的个数"
    },
    {
      "order": 12,
      "stage": "高难冲刺",
      "id": "A28",
      "focus": "多项式符号、圆及棱锥"
    },
    {
      "order": 13,
      "stage": "高难冲刺",
      "id": "A35",
      "focus": "棱锥与高次式因式"
    },
    {
      "order": 14,
      "stage": "高难冲刺",
      "id": "A42",
      "focus": "三角、棱锥与解的唯一性"
    },
    {
      "order": 15,
      "stage": "高难冲刺",
      "id": "A34",
      "focus": "根式唯一解与整数参数"
    }
  ]
});
