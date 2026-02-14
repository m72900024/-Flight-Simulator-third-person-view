export const FLIGHT_MODES = {
    ACRO: 0,    // 手動 (純角速度)
    ANGLE: 1,   // 自穩 (限制角度)
    HORIZON: 2  // 半自穩 (中間自穩，打到底變手動)
};

export const CONFIG = {
    // 物理 (模擬 5吋 FPV 無人機，約 600g)
    gravity: 9.81,
    mass: 0.6,          // kg
    maxThrust: 28.0,
    dragCoeff: 0.15,    // 空氣阻力 (↑ 更真實的減速)
    angularDrag: 8.0,   // 角速度阻尼 (鬆桿後自然停轉)
    hardDeck: 0.05,
    maxHeight: 30,      // LOS 飛行最大合理高度 (超過會有警告)
    
    // 手感
    thrustPower: 18,    // 推力 (懸停約55%油門，更溫和可控)
    thrustExpo: 0.3,    // 油門指數曲線 (0=線性, 1=全指數)
    rates: 1.2,         // 角速度倍率 (720 deg/s)
    superRate: 0.7,     // 搖桿末端加速 (Betaflight style)
    maxTiltAngle: 55,   // 自穩模式最大傾角 (度)

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
    },

    // 端點校正 (min/max)
    endpoints: {
        thrust: { min: -1, max: 1 },
        yaw:    { min: -1, max: 1 },
        pitch:  { min: -1, max: 1 },
        roll:   { min: -1, max: 1 }
    }
};
