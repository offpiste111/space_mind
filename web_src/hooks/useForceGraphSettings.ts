import { useEffect } from 'react';
import * as d3force from 'd3-force';

export const useForceGraphSettings = (fgRef: React.MutableRefObject<any>) => {
    useEffect(() => {
        if (fgRef.current) {
            // D3フォースシミュレーションパラメータの設定
            fgRef.current.d3Force('link').distance(2).strength(1);
            fgRef.current.d3Force('collision', d3force.forceCollide(150));
            fgRef.current.d3Force('charge', d3force.forceManyBody().strength(-10));
            
            const camera = fgRef.current.camera();
            camera.fov = 60; // 視野角
            camera.updateProjectionMatrix();

            // --- マウス速度に応じた可変パン/回転速度制御 ---
            const state = {
                isLeftDown: false,
                isRightDown: false,
                lastX: 0,
                lastY: 0,
                lastTime: 0,
                speed: 0,
            };

            const onMouseDown = (e: MouseEvent) => {
                if (e.button === 0) {
                    state.isLeftDown = true;
                    state.lastX = e.clientX;
                    state.lastY = e.clientY;
                    state.lastTime = performance.now();
                    state.speed = 0;
                } else if (e.button === 2) {
                    state.isRightDown = true;
                    state.lastX = e.clientX;
                    state.lastY = e.clientY;
                    state.lastTime = performance.now();
                    state.speed = 0;
                }
            };
            const onMouseUp = (e: MouseEvent) => {
                if (e.button === 0) {
                    state.isLeftDown = false;
                    state.speed = 0;
                    // ドラッグ終了後は元の回転速度に戻す
                    const controls = fgRef.current?.controls();
                    if (controls) controls.rotateSpeed = 1.0;
                } else if (e.button === 2) {
                    state.isRightDown = false;
                    state.speed = 0;
                    // ドラッグ終了後は元のパン速度に戻す
                    const controls = fgRef.current?.controls();
                    if (controls) controls.panSpeed = 0.3;
                }
            };
            const onMouseMove = (e: MouseEvent) => {
                if (!state.isLeftDown && !state.isRightDown) return;
                const now = performance.now();
                const dt = now - state.lastTime;
                if (dt > 0) {
                    const dist = Math.hypot(e.clientX - state.lastX, e.clientY - state.lastY);
                    const instant = dist / dt; // px per ms
                    // 指数移動平均でスムージング
                    state.speed = state.speed * 0.5 + instant * 0.5;
                }
                state.lastX = e.clientX;
                state.lastY = e.clientY;
                state.lastTime = now;
            };

            let rafId: number;
            const updateSpeeds = () => {
                const controls = fgRef.current?.controls();
                if (controls) {
                    if (state.isLeftDown) {
                        // 速度に応じて rotateSpeed を可変に
                        // 低速時 0.03、高速時最大 1.5 程度
                        const speedFactor = Math.min(state.speed * 5, 3.0);
                        controls.rotateSpeed = 0.03 + speedFactor * 0.05;
                    } else if (state.isRightDown) {
                        // 速度に応じて panSpeed を可変に
                        // 低速時 0.01、高速時最大 1.3 程度
                        const speedFactor = Math.min(state.speed * 5, 3.0);
                        controls.panSpeed = 0.01 + speedFactor * 0.05;
                    }
                }
                // 速度を減衰
                state.speed *= 0.9;
                rafId = requestAnimationFrame(updateSpeeds);
            };

            window.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('mousemove', onMouseMove);
            rafId = requestAnimationFrame(updateSpeeds);

            return () => {
                window.removeEventListener('mousedown', onMouseDown);
                window.removeEventListener('mouseup', onMouseUp);
                window.removeEventListener('mousemove', onMouseMove);
                cancelAnimationFrame(rafId);
                const controls = fgRef.current?.controls();
                if (controls) {
                    controls.rotateSpeed = 1.0;
                    controls.panSpeed = 0.3;
                }
            };
        }
    }, [fgRef]);
};
