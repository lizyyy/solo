// 输入系统模块
var Input = (function() {
    'use strict';
    
    var inputState = {
        up: false,
        down: false,
        left: false,
        right: false,
        interact: false,
        pause: false
    };
    
    var keyJustPressed = {
        interact: false,
        pause: false
    };
    
    var keyBindings = {
        up: ['ArrowUp', 'KeyW'],
        down: ['ArrowDown', 'KeyS'],
        left: ['ArrowLeft', 'KeyA'],
        right: ['ArrowRight', 'KeyD'],
        interact: ['Space'],
        pause: ['Escape']
    };
    
    function isKeyInBinding(event, binding) {
        return binding.indexOf(event.code) !== -1;
    }
    
    function handleKeyDown(event) {
        for (var action in keyBindings) {
            if (keyBindings.hasOwnProperty(action)) {
                if (isKeyInBinding(event, keyBindings[action])) {
                    if (!inputState[action]) {
                        keyJustPressed[action] = true;
                    }
                    inputState[action] = true;
                    event.preventDefault();
                }
            }
        }
    }
    
    function handleKeyUp(event) {
        for (var action in keyBindings) {
            if (keyBindings.hasOwnProperty(action)) {
                if (isKeyInBinding(event, keyBindings[action])) {
                    inputState[action] = false;
                    event.preventDefault();
                }
            }
        }
    }
    
    return {
        // 初始化输入系统
        init: function() {
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('keyup', handleKeyUp);
            
            // 重置状态
            for (var key in inputState) {
                if (inputState.hasOwnProperty(key)) {
                    inputState[key] = false;
                }
            }
            for (var key in keyJustPressed) {
                if (keyJustPressed.hasOwnProperty(key)) {
                    keyJustPressed[key] = false;
                }
            }
        },
        
        // 获取当前输入状态
        getState: function() {
            return Utils.deepClone(inputState);
        },
        
        // 检查某个按键是否刚被按下
        isJustPressed: function(action) {
            var pressed = keyJustPressed[action] === true;
            keyJustPressed[action] = false;
            return pressed;
        },
        
        // 检查是否有移动输入
        hasMovement: function() {
            return inputState.up || inputState.down || inputState.left || inputState.right;
        },
        
        // 获取移动方向向量
        getMovementVector: function() {
            var dx = 0;
            var dy = 0;
            
            if (inputState.up) dy -= 1;
            if (inputState.down) dy += 1;
            if (inputState.left) dx -= 1;
            if (inputState.right) dx += 1;
            
            // 标准化
            var magnitude = Math.sqrt(dx * dx + dy * dy);
            if (magnitude > 0) {
                dx /= magnitude;
                dy /= magnitude;
            }
            
            return { x: dx, y: dy };
        },
        
        // 重置所有按键状态
        reset: function() {
            for (var key in inputState) {
                if (inputState.hasOwnProperty(key)) {
                    inputState[key] = false;
                }
            }
            for (var key in keyJustPressed) {
                if (keyJustPressed.hasOwnProperty(key)) {
                    keyJustPressed[key] = false;
                }
            }
        },
        
        // 更新（用于处理连续按键状态）
        update: function() {
            // 清除上一帧的瞬时按键状态
            for (var key in keyJustPressed) {
                if (keyJustPressed.hasOwnProperty(key)) {
                    keyJustPressed[key] = false;
                }
            }
        },
        
        // 添加自定义按键绑定
        addBinding: function(action, keyCode) {
            if (keyBindings[action]) {
                if (keyBindings[action].indexOf(keyCode) === -1) {
                    keyBindings[action].push(keyCode);
                }
            } else {
                keyBindings[action] = [keyCode];
                inputState[action] = false;
                keyJustPressed[action] = false;
            }
        },
        
        // 移除按键绑定
        removeBinding: function(action, keyCode) {
            if (keyBindings[action]) {
                var index = keyBindings[action].indexOf(keyCode);
                if (index !== -1) {
                    keyBindings[action].splice(index, 1);
                }
            }
        },
        
        // 获取当前按键绑定
        getBindings: function() {
            return Utils.deepClone(keyBindings);
        },
        
        // 销毁输入系统
        destroy: function() {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            this.reset();
        }
    };
})();
