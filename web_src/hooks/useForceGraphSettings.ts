import { useEffect } from 'react';
import * as d3force from 'd3-force';

export const useForceGraphSettings = (fgRef: React.MutableRefObject<any>) => {
    useEffect(() => {
        if (fgRef.current) {
            // 非常に緩やかで滑らかな力学パラメータの設定（サンプルのように穏やかに動く）
            fgRef.current.d3Force('link').distance(120).strength(0.08); // 引っ張り力を非常に弱く（0.08）して、ゴムのように優しく伸ばす
            fgRef.current.d3Force('collision', d3force.forceCollide(50).strength(0.08)); // 衝突判定の強度をさらに落として、ノード同士が重なりを避ける際にブルブルと震えたり弾けたりするのを防ぐ
            fgRef.current.d3Force('charge', d3force.forceManyBody().strength(-60)); // 斥力（反発力）を-60に落とし、穏やかに全体に広がるようにする
            
            const camera = fgRef.current.camera();
            camera.fov = 60; // 視野角
            camera.updateProjectionMatrix();

            // --- 滑らかで使いやすい固定のカメラ制御速度を設定 ---
            const controls = fgRef.current.controls();
            if (controls) {
                controls.rotateSpeed = 0.5; // カメラの回転を穏やかに（標準1.0から0.5に下げて過敏さを排除）
                controls.panSpeed = 0.25;   // パンの移動速度を穏やかに（標準0.3から0.25に微調整）
                controls.enableDamping = true; // 滑らかな慣性を有効化
                controls.dampingFactor = 0.05; // 慣性の減衰率
            }
        }
    }, [fgRef]);
};

