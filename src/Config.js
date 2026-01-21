export const FLIGHT_MODES = {
    ACRO: 0,    // 手動 (純角速度)
    ANGLE: 1,   // 自穩 (限制角度)
    HORIZON: 2  // 半自穩 (中間自穩，打到底變手動)
};

export const CONFIG = {
    // 物理
    gravity: 9.81,
    mass: 0.6,
    maxThrust: 28.0,
    dragCoeff: 0.05,
    hardDeck: 0.05,
    
    // 手感
    thrustPower: 35,
    rates: 1.0,
    maxTiltAngle: 45, // 自穩模式最大傾角 (度)

    // 預設映射
    axes: { 
        thrust: 2, 
        yaw: 0, 
        pitch: 1, 
        roll: 3, 
        arm: 4,
        mode: 5 // [新增] 用來切換模式的開關通道 (AUX)
    },
    
    invert: {
        t: false, r: false, e: true, a: false
    },

    // [新增] 校正資料 (中點偏移量)
    calibration: {
        roll: 0,
        pitch: 0,
        yaw: 0,
        thrust: 0
    }
};
