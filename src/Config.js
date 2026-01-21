export const CONFIG = {
    gravity: 9.81,
    mass: 0.6,
    maxThrust: 28.0,
    dragCoeff: 0.05,
    hardDeck: 0.05,
    
    thrustPower: 35,
    rates: 1.0,

    axes: { roll: 0, pitch: 1, thrust: 3, yaw: 4, arm: 2 },
    
    // 反轉設定 (會在 Input.js 中動態讀取)
    invert: {
        t: false,
        r: false,
        p: true,  // 預設 Pitch 反轉
        y: false
    }
};
