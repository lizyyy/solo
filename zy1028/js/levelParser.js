export const ValidationErrorTypes = {
    INVALID_JSON: 'invalid_json',
    MISSING_FIELD: 'missing_field',
    INVALID_TYPE: 'invalid_type',
    INVALID_VALUE: 'invalid_value',
    EMPTY_ARRAY: 'empty_array',
    DUPLICATE_ID: 'duplicate_id',
    UNKNOWN_ERROR: 'unknown_error'
};

export class ValidationError extends Error {
    constructor(type, message, field = null) {
        super(message);
        this.type = type;
        this.field = field;
        this.name = 'ValidationError';
    }
}

export const defaultLevels = [
    {
        id: 'level_1',
        name: '新手入门',
        description: '学习基本操作，熟悉游戏流程',
        difficulty: 1,
        duration: 120,
        initialIngredients: {
            noodles: 10,
            toppings: 10
        },
        maxIngredients: {
            noodles: 20,
            toppings: 20
        },
        restockAmount: 5,
        wokCount: 1,
        packingCount: 1,
        customerSpawnRate: 15,
        maxCustomers: 3,
        dishes: [
            {
                name: '蛋炒粉',
                description: '经典蛋炒粉',
                ingredients: {
                    noodles: 1,
                    toppings: 1
                },
                cookTime: 8,
                score: 100,
                tip: 20
            },
            {
                name: '肉炒粉',
                description: '加肉炒粉',
                ingredients: {
                    noodles: 1,
                    toppings: 2
                },
                cookTime: 10,
                score: 150,
                tip: 30
            }
        ],
        customerPool: [
            {
                name: '小明',
                patience: 45,
                dishes: ['蛋炒粉'],
                tipMultiplier: 1.0
            },
            {
                name: '小红',
                patience: 40,
                dishes: ['蛋炒粉', '肉炒粉'],
                tipMultiplier: 1.2
            }
        ]
    },
    {
        id: 'level_2',
        name: '忙碌夜市',
        description: '顾客更多了，需要同时处理多个订单',
        difficulty: 2,
        duration: 180,
        initialIngredients: {
            noodles: 15,
            toppings: 15
        },
        maxIngredients: {
            noodles: 30,
            toppings: 30
        },
        restockAmount: 5,
        wokCount: 2,
        packingCount: 2,
        customerSpawnRate: 12,
        maxCustomers: 5,
        dishes: [
            {
                name: '蛋炒粉',
                description: '经典蛋炒粉',
                ingredients: {
                    noodles: 1,
                    toppings: 1
                },
                cookTime: 8,
                score: 100,
                tip: 20
            },
            {
                name: '肉炒粉',
                description: '加肉炒粉',
                ingredients: {
                    noodles: 1,
                    toppings: 2
                },
                cookTime: 10,
                score: 150,
                tip: 30
            },
            {
                name: '豪华炒粉',
                description: '蛋肉齐全的豪华炒粉',
                ingredients: {
                    noodles: 2,
                    toppings: 3
                },
                cookTime: 12,
                score: 200,
                tip: 50
            }
        ],
        customerPool: [
            {
                name: '小明',
                patience: 45,
                dishes: ['蛋炒粉'],
                tipMultiplier: 1.0
            },
            {
                name: '小红',
                patience: 40,
                dishes: ['蛋炒粉', '肉炒粉'],
                tipMultiplier: 1.2
            },
            {
                name: '小刚',
                patience: 35,
                dishes: ['肉炒粉', '豪华炒粉'],
                tipMultiplier: 1.5
            },
            {
                name: '小丽',
                patience: 50,
                dishes: ['蛋炒粉', '豪华炒粉'],
                tipMultiplier: 1.3
            }
        ]
    },
    {
        id: 'level_3',
        name: '晚高峰',
        description: '最忙碌的时段，考验你的协调能力',
        difficulty: 3,
        duration: 240,
        initialIngredients: {
            noodles: 20,
            toppings: 20
        },
        maxIngredients: {
            noodles: 40,
            toppings: 40
        },
        restockAmount: 5,
        wokCount: 3,
        packingCount: 2,
        customerSpawnRate: 8,
        maxCustomers: 8,
        dishes: [
            {
                name: '蛋炒粉',
                description: '经典蛋炒粉',
                ingredients: {
                    noodles: 1,
                    toppings: 1
                },
                cookTime: 8,
                score: 100,
                tip: 20
            },
            {
                name: '肉炒粉',
                description: '加肉炒粉',
                ingredients: {
                    noodles: 1,
                    toppings: 2
                },
                cookTime: 10,
                score: 150,
                tip: 30
            },
            {
                name: '豪华炒粉',
                description: '蛋肉齐全的豪华炒粉',
                ingredients: {
                    noodles: 2,
                    toppings: 3
                },
                cookTime: 12,
                score: 200,
                tip: 50
            },
            {
                name: '超大份炒粉',
                description: '超大份量的炒粉',
                ingredients: {
                    noodles: 3,
                    toppings: 4
                },
                cookTime: 15,
                score: 300,
                tip: 80
            }
        ],
        customerPool: [
            {
                name: '小明',
                patience: 40,
                dishes: ['蛋炒粉'],
                tipMultiplier: 1.0
            },
            {
                name: '小红',
                patience: 35,
                dishes: ['蛋炒粉', '肉炒粉'],
                tipMultiplier: 1.2
            },
            {
                name: '小刚',
                patience: 30,
                dishes: ['肉炒粉', '豪华炒粉'],
                tipMultiplier: 1.5
            },
            {
                name: '小丽',
                patience: 45,
                dishes: ['蛋炒粉', '豪华炒粉'],
                tipMultiplier: 1.3
            },
            {
                name: '大胃王',
                patience: 25,
                dishes: ['豪华炒粉', '超大份炒粉'],
                tipMultiplier: 2.0
            },
            {
                name: '着急的上班族',
                patience: 20,
                dishes: ['蛋炒粉', '肉炒粉'],
                tipMultiplier: 1.8
            }
        ]
    }
];

export class LevelParser {
    static parse(jsonString) {
        try {
            const level = JSON.parse(jsonString);
            this.validateLevel(level);
            return level;
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new ValidationError(
                    ValidationErrorTypes.INVALID_JSON,
                    'JSON格式错误，请检查语法',
                    'json'
                );
            }
            throw error;
        }
    }

    static validateLevel(level) {
        if (typeof level !== 'object' || level === null || Array.isArray(level)) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_TYPE,
                '关卡数据必须是对象类型',
                'root'
            );
        }

        const requiredFields = [
            'id', 'name', 'description', 'difficulty', 'duration',
            'initialIngredients', 'maxIngredients', 'restockAmount',
            'wokCount', 'packingCount', 'customerSpawnRate', 'maxCustomers',
            'dishes', 'customerPool'
        ];

        for (const field of requiredFields) {
            if (!(field in level)) {
                throw new ValidationError(
                    ValidationErrorTypes.MISSING_FIELD,
                    `缺少必填字段: ${field}`,
                    field
                );
            }
        }

        this.validateString(level.id, 'id', { minLength: 1, maxLength: 50 });
        this.validateString(level.name, 'name', { minLength: 1, maxLength: 50 });
        this.validateString(level.description, 'description', { minLength: 0, maxLength: 200 });
        
        this.validateNumber(level.difficulty, 'difficulty', { min: 1, max: 10, integer: true });
        this.validateNumber(level.duration, 'duration', { min: 60, max: 600, integer: true });
        
        this.validateIngredients(level.initialIngredients, 'initialIngredients');
        this.validateIngredients(level.maxIngredients, 'maxIngredients');
        
        if (level.initialIngredients.noodles > level.maxIngredients.noodles) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_VALUE,
                '初始米粉数量不能超过最大库存',
                'initialIngredients.noodles'
            );
        }
        if (level.initialIngredients.toppings > level.maxIngredients.toppings) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_VALUE,
                '初始配菜数量不能超过最大库存',
                'initialIngredients.toppings'
            );
        }
        
        this.validateNumber(level.restockAmount, 'restockAmount', { min: 1, max: 20, integer: true });
        this.validateNumber(level.wokCount, 'wokCount', { min: 1, max: 5, integer: true });
        this.validateNumber(level.packingCount, 'packingCount', { min: 1, max: 5, integer: true });
        this.validateNumber(level.customerSpawnRate, 'customerSpawnRate', { min: 5, max: 60, integer: true });
        this.validateNumber(level.maxCustomers, 'maxCustomers', { min: 1, max: 20, integer: true });
        
        this.validateDishes(level.dishes);
        this.validateCustomerPool(level.customerPool, level.dishes);
        
        return true;
    }

    static validateString(value, fieldName, options = {}) {
        const { minLength = 0, maxLength = Infinity } = options;
        
        if (typeof value !== 'string') {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_TYPE,
                `字段 ${fieldName} 必须是字符串类型`,
                fieldName
            );
        }
        
        if (value.length < minLength) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_VALUE,
                `字段 ${fieldName} 长度不能小于 ${minLength}`,
                fieldName
            );
        }
        
        if (value.length > maxLength) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_VALUE,
                `字段 ${fieldName} 长度不能超过 ${maxLength}`,
                fieldName
            );
        }
    }

    static validateNumber(value, fieldName, options = {}) {
        const { min = -Infinity, max = Infinity, integer = false } = options;
        
        if (typeof value !== 'number' || isNaN(value)) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_TYPE,
                `字段 ${fieldName} 必须是数字类型`,
                fieldName
            );
        }
        
        if (integer && !Number.isInteger(value)) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_VALUE,
                `字段 ${fieldName} 必须是整数`,
                fieldName
            );
        }
        
        if (value < min) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_VALUE,
                `字段 ${fieldName} 不能小于 ${min}`,
                fieldName
            );
        }
        
        if (value > max) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_VALUE,
                `字段 ${fieldName} 不能大于 ${max}`,
                fieldName
            );
        }
    }

    static validateIngredients(ingredients, fieldName) {
        if (typeof ingredients !== 'object' || ingredients === null || Array.isArray(ingredients)) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_TYPE,
                `字段 ${fieldName} 必须是对象类型`,
                fieldName
            );
        }
        
        if (!('noodles' in ingredients)) {
            throw new ValidationError(
                ValidationErrorTypes.MISSING_FIELD,
                `字段 ${fieldName} 缺少 noodles`,
                `${fieldName}.noodles`
            );
        }
        
        if (!('toppings' in ingredients)) {
            throw new ValidationError(
                ValidationErrorTypes.MISSING_FIELD,
                `字段 ${fieldName} 缺少 toppings`,
                `${fieldName}.toppings`
            );
        }
        
        this.validateNumber(ingredients.noodles, `${fieldName}.noodles`, { min: 0, max: 100, integer: true });
        this.validateNumber(ingredients.toppings, `${fieldName}.toppings`, { min: 0, max: 100, integer: true });
    }

    static validateDishes(dishes) {
        if (!Array.isArray(dishes)) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_TYPE,
                '字段 dishes 必须是数组类型',
                'dishes'
            );
        }
        
        if (dishes.length === 0) {
            throw new ValidationError(
                ValidationErrorTypes.EMPTY_ARRAY,
                '字段 dishes 不能为空数组',
                'dishes'
            );
        }
        
        const dishNames = new Set();
        
        dishes.forEach((dish, index) => {
            const fieldPrefix = `dishes[${index}]`;
            
            if (typeof dish !== 'object' || dish === null || Array.isArray(dish)) {
                throw new ValidationError(
                    ValidationErrorTypes.INVALID_TYPE,
                    `${fieldPrefix} 必须是对象类型`,
                    fieldPrefix
                );
            }
            
            const requiredFields = ['name', 'description', 'ingredients', 'cookTime', 'score', 'tip'];
            
            for (const field of requiredFields) {
                if (!(field in dish)) {
                    throw new ValidationError(
                        ValidationErrorTypes.MISSING_FIELD,
                        `${fieldPrefix} 缺少必填字段: ${field}`,
                        `${fieldPrefix}.${field}`
                    );
                }
            }
            
            this.validateString(dish.name, `${fieldPrefix}.name`, { minLength: 1, maxLength: 30 });
            this.validateString(dish.description, `${fieldPrefix}.description`, { minLength: 0, maxLength: 100 });
            
            if (dishNames.has(dish.name)) {
                throw new ValidationError(
                    ValidationErrorTypes.DUPLICATE_ID,
                    `菜品名称重复: ${dish.name}`,
                    `${fieldPrefix}.name`
                );
            }
            dishNames.add(dish.name);
            
            this.validateIngredients(dish.ingredients, `${fieldPrefix}.ingredients`);
            this.validateNumber(dish.cookTime, `${fieldPrefix}.cookTime`, { min: 3, max: 30, integer: true });
            this.validateNumber(dish.score, `${fieldPrefix}.score`, { min: 10, max: 1000, integer: true });
            this.validateNumber(dish.tip, `${fieldPrefix}.tip`, { min: 0, max: 500, integer: true });
        });
    }

    static validateCustomerPool(customerPool, dishes) {
        if (!Array.isArray(customerPool)) {
            throw new ValidationError(
                ValidationErrorTypes.INVALID_TYPE,
                '字段 customerPool 必须是数组类型',
                'customerPool'
            );
        }
        
        if (customerPool.length === 0) {
            throw new ValidationError(
                ValidationErrorTypes.EMPTY_ARRAY,
                '字段 customerPool 不能为空数组',
                'customerPool'
            );
        }
        
        const dishNames = new Set(dishes.map(d => d.name));
        
        customerPool.forEach((customer, index) => {
            const fieldPrefix = `customerPool[${index}]`;
            
            if (typeof customer !== 'object' || customer === null || Array.isArray(customer)) {
                throw new ValidationError(
                    ValidationErrorTypes.INVALID_TYPE,
                    `${fieldPrefix} 必须是对象类型`,
                    fieldPrefix
                );
            }
            
            const requiredFields = ['name', 'patience', 'dishes', 'tipMultiplier'];
            
            for (const field of requiredFields) {
                if (!(field in customer)) {
                    throw new ValidationError(
                        ValidationErrorTypes.MISSING_FIELD,
                        `${fieldPrefix} 缺少必填字段: ${field}`,
                        `${fieldPrefix}.${field}`
                    );
                }
            }
            
            this.validateString(customer.name, `${fieldPrefix}.name`, { minLength: 1, maxLength: 20 });
            this.validateNumber(customer.patience, `${fieldPrefix}.patience`, { min: 10, max: 120, integer: true });
            
            if (!Array.isArray(customer.dishes)) {
                throw new ValidationError(
                    ValidationErrorTypes.INVALID_TYPE,
                    `${fieldPrefix}.dishes 必须是数组类型`,
                    `${fieldPrefix}.dishes`
                );
            }
            
            if (customer.dishes.length === 0) {
                throw new ValidationError(
                    ValidationErrorTypes.EMPTY_ARRAY,
                    `${fieldPrefix}.dishes 不能为空数组`,
                    `${fieldPrefix}.dishes`
                );
            }
            
            customer.dishes.forEach((dishName, dishIndex) => {
                if (typeof dishName !== 'string') {
                    throw new ValidationError(
                        ValidationErrorTypes.INVALID_TYPE,
                        `${fieldPrefix}.dishes[${dishIndex}] 必须是字符串类型`,
                        `${fieldPrefix}.dishes[${dishIndex}]`
                    );
                }
                
                if (!dishNames.has(dishName)) {
                    throw new ValidationError(
                        ValidationErrorTypes.INVALID_VALUE,
                        `顾客 ${customer.name} 的菜品 ${dishName} 不在菜品列表中`,
                        `${fieldPrefix}.dishes[${dishIndex}]`
                    );
                }
            });
            
            this.validateNumber(customer.tipMultiplier, `${fieldPrefix}.tipMultiplier`, { min: 0.1, max: 5.0 });
        });
    }

    static toJSON(level) {
        return JSON.stringify(level, null, 2);
    }

    static parseMultiple(jsonString) {
        try {
            const levels = JSON.parse(jsonString);
            
            if (!Array.isArray(levels)) {
                const singleLevel = this.parse(jsonString);
                return [singleLevel];
            }
            
            const validatedLevels = [];
            const errors = [];
            
            levels.forEach((level, index) => {
                try {
                    this.validateLevel(level);
                    validatedLevels.push(level);
                } catch (error) {
                    errors.push({
                        index,
                        error: error
                    });
                }
            });
            
            if (errors.length > 0) {
                const errorMessages = errors.map(e => 
                    `关卡 ${e.index + 1}: ${e.error.message}`
                ).join('\n');
                
                throw new ValidationError(
                    ValidationErrorTypes.INVALID_VALUE,
                    `部分关卡验证失败:\n${errorMessages}`,
                    'multiple_levels'
                );
            }
            
            return validatedLevels;
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new ValidationError(
                    ValidationErrorTypes.INVALID_JSON,
                    'JSON格式错误，请检查语法',
                    'json'
                );
            }
            throw error;
        }
    }
}

export const levelParser = new LevelParser();
