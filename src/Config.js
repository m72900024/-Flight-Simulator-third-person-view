export const CONFIG = {
    gravity: 9.81,
    mass: 0.6,
    maxThrust: 28.0,
    dragCoeff: 0.05,
    hardDeck: 0.05,
    
    thrustPower: 35,
    rates: 1.0,

    // 預設映射 (大部分搖桿是 0:Roll, 1:Pitch, 2:Throttle or Pitch...)
    // 這裡只是預設值，進入網頁後會被選單覆蓋
    axes: { 
        roll: 0, 
        pitch: 1, 
        thrust: 3, // 有些是 2
        yaw: 4,    // 有些是 3
        arm: 5     // 通常是開關
    },
    
    invert: {
        t: false,
        r: false,
        e: true, // Elevator (Pitch) 通常需要反轉
        a: false
    }
};
