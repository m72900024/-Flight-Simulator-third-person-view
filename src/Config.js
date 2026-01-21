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

    // 預設映射 (會被 UI 覆蓋)
    axes: { 
        thrust: 2, 
        yaw: 0, 
        pitch: 1, 
        roll: 3, 
        arm: 4 
    },
    
    // 反轉設定
    invert: {
        t: false,
        r: false,
        e: true, // Pitch 預設反轉
        a: false
    }
};
