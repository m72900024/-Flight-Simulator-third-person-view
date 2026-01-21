export const CONFIG = {
    // 物理參數
    gravity: 9.81,
    mass: 0.6,
    maxThrust: 28.0,
    dragCoeff: 0.05,
    hardDeck: 0.05, // 地板高度

    // 飛行手感
    rates: 1.0,         // 靈敏度
    thrustPower: 35,    // 動力大小
    
    // 搖桿映射 (可依需求修改)
    axes: {
        roll: 0,
        pitch: 1,
        thrust: 3,
        yaw: 4,
        arm: 2
    },
    invert: {
        roll: false,
        pitch: true,  // 通常 pitch 需要反轉
        thrust: false, // 視搖桿而定，有的需要反轉
        yaw: false
    }
};
