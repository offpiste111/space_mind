import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GraphData, GroupVisual, GroupData } from '../types/graph';

export const useGroupVisuals = (
    fgRef: React.MutableRefObject<any>,
    graphData: GraphData,
    cloudTexture: THREE.Texture | null,
    htmlNodeCache: React.MutableRefObject<Map<number, any>>
) => {
    const groupVisualsRef = useRef<Map<number, GroupVisual>>(new Map());
    const auraSpritesRef = useRef<Map<string, THREE.Sprite>>(new Map());

    useEffect(() => {
        let animationFrameId: number;

        const updateGroups = () => {
            const scene = fgRef.current?.scene();
            if (!scene) {
                animationFrameId = requestAnimationFrame(updateGroups);
                return;
            }

            // カメラの向きベクトルを取得し、雲やオーラが手前にかぶらないように奥行きを微調整する
            const camera = fgRef.current?.camera();
            const camDir = new THREE.Vector3(0, 0, -1);
            if (camera) {
                camera.getWorldDirection(camDir);
            }

            const activeGroupIds = new Set<number>();

            // 子孫ノードを再帰的に取得（友達リンクは除外）
            const getDescendantIds = (leaderId: number, nodes: any[], links: any[]): Set<number> => {
                const descendants = new Set<number>();
                descendants.add(leaderId);
                
                const queue = [leaderId];
                while (queue.length > 0) {
                    const currentId = queue.shift()!;
                    links.forEach((link: any) => {
                        if (link.type === 'friend') {
                            return; // 友達リンクは含めない
                        }
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

                        if (String(sourceId) === String(currentId)) {
                            const targetNode = nodes.find(n => n.id === targetId);
                            if (targetNode && !descendants.has(targetNode.id)) {
                                descendants.add(targetNode.id);
                                queue.push(targetNode.id);
                            }
                        }
                    });
                }
                return descendants;
            };

            const getAncestors = (nodeId: number, links: any[]): Set<string> => {
                const ancestors = new Set<string>();
                const queue: string[] = [String(nodeId)];
                const visited = new Set<string>([String(nodeId)]);

                while (queue.length > 0) {
                    const curr = queue.shift()!;
                    for (const link of links) {
                        const sId = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
                        const tId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;

                        if (String(tId) === curr) {
                            const parentId = String(sId);
                            if (!visited.has(parentId)) {
                                visited.add(parentId);
                                ancestors.add(parentId);
                                queue.push(parentId);
                            }
                        }
                    }
                }
                return ancestors;
            };

            const isNodeVisible = (node: any): boolean => {
                if (!node) return false;
                const ancestors = getAncestors(node.id, graphData.links);
                for (const ancestorId of ancestors) {
                    const ancestorNode = graphData.nodes.find(n => String(n.id) === String(ancestorId));
                    if (ancestorNode && ancestorNode.collapsed) {
                        return false;
                    }
                }
                return true;
            };

            const isLinkVisible = (link: any): boolean => {
                if (!link) return false;
                const sourceId = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
                const targetId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;

                const sourceNode = graphData.nodes.find(n => String(n.id) === String(sourceId));
                const targetNode = graphData.nodes.find(n => String(n.id) === String(targetId));

                if (sourceNode && !isNodeVisible(sourceNode)) return false;
                if (targetNode && !isNodeVisible(targetNode)) return false;

                return true;
            };

            // nodes の中から type === 'group' のノードを探してグループ定義を作成
            const groups: any[] = [];
            graphData.nodes.forEach((node: any) => {
                if (node.type === 'group') {
                    groups.push({
                        id: node.id,
                        name: node.name || `グループ ${node.id}`,
                        color: node.groupColor || '#4c9ac0',
                        shape: node.groupShape || 'cloud',
                    });
                }
            });

            groups.forEach((group: any) => {
                // 形状が 'none'（なし）の場合は描画しないのでスキップ
                if (group.shape === 'none') {
                    return;
                }

                const descendantIds = getDescendantIds(group.id, graphData.nodes, graphData.links);
                const nodesInGroup = graphData.nodes.filter(n => descendantIds.has(n.id) && isNodeVisible(n));
                if (nodesInGroup.length === 0) return; // ノードがないグループは描画しない

                activeGroupIds.add(group.id);

                let visualObj = groupVisualsRef.current.get(group.id);

                if (!visualObj) {
                    visualObj = {
                        nodeBubbles: new Map(),
                        linkTubes: new Map(),
                        groupId: group.id
                    };
                    groupVisualsRef.current.set(group.id, visualObj);
                }

                const hexColor = group.color || '#4c9ac0';
                const isAura = group.shape === 'aura';

                if (isAura) {
                    // オーラの場合は雲を表示しないので、既存があれば削除
                    if (visualObj) {
                        visualObj.nodeBubbles.forEach((bubbleSprites) => {
                            bubbleSprites.forEach(sprite => {
                                scene.remove(sprite);
                                if (sprite.material) (sprite.material as THREE.Material).dispose();
                            });
                        });
                        visualObj.nodeBubbles.clear();

                        visualObj.linkTubes.forEach((tubes) => {
                            tubes.forEach(sprite => {
                                scene.remove(sprite);
                                if (sprite.material) (sprite.material as THREE.Material).dispose();
                            });
                        });
                        visualObj.linkTubes.clear();
                    }
                } else {
                    // --- 1. ノード周囲の個別星雲オーラ (Node Bubbles) の管理 ---
                    const activeNodeIds = new Set<number>();
                    nodesInGroup.forEach(node => {
                        activeNodeIds.add(node.id);
                        let bubbleSprites = visualObj!.nodeBubbles.get(node.id);

                        const nx = node.x ?? 0;
                        const ny = node.y ?? 0;
                        const nz = node.z ?? 0;

                        // ノードの種類やカスタムサイズから実際の3D物理寸法を取得
                        let defaultWidth = 200;
                        let defaultHeight = 120;
                        if (node.type === "issue") {
                            defaultWidth = 300;
                            defaultHeight = 200;
                        } else if (node.type === "task") {
                            defaultWidth = 250;
                            defaultHeight = 150;
                        } else if (node.type && node.type !== "normal") {
                            defaultWidth = 250;
                            defaultHeight = 100;
                        }
                        const nodeWidth = node.size_x || defaultWidth;
                        const nodeHeight = node.size_y || defaultHeight;
                        const diagonal = Math.sqrt(nodeWidth * nodeWidth + nodeHeight * nodeHeight);

                        const clusterSize = 2; // 各ノード周囲に2つの非対称スプライトを重ねて配置

                        if (!bubbleSprites && cloudTexture) {
                            bubbleSprites = [];
                            for (let i = 0; i < clusterSize; i++) {
                                const mat = new THREE.SpriteMaterial({
                                    map: cloudTexture,
                                    color: new THREE.Color(hexColor),
                                    transparent: true,
                                    opacity: 0.15,
                                    depthWrite: false
                                });
                                mat.rotation = Math.random() * Math.PI * 2;

                                const sprite = new THREE.Sprite(mat);
                                const baseScale = diagonal * 1.5;
                                sprite.scale.set(baseScale, baseScale, 1);
                                
                                sprite.userData = {
                                    offsetX: 1,
                                    offsetY: 1,
                                    offsetZ: 1,
                                    baseRotation: mat.rotation,
                                    rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.01 + Math.random() * 0.02),
                                    baseScale: baseScale,
                                    phaseX: Math.random() * Math.PI * 2,
                                    phaseY: Math.random() * Math.PI * 2,
                                    phaseZ: Math.random() * Math.PI * 2,
                                    phaseScale: Math.random() * Math.PI * 2
                                };

                                scene.add(sprite);
                                bubbleSprites.push(sprite);
                            }
                            visualObj!.nodeBubbles.set(node.id, bubbleSprites);
                        } else if (bubbleSprites) {
                            // 色を最新に同期
                            bubbleSprites.forEach(sprite => {
                                const mat = sprite.material as THREE.SpriteMaterial;
                                if (mat.color.getHexString() !== new THREE.Color(hexColor).getHexString()) {
                                    mat.color.set(hexColor);
                                }
                            });
                        }

                        if (bubbleSprites) {
                            const time = performance.now() * 0.001;
                            bubbleSprites.forEach(sprite => {
                                const ud = sprite.userData;
                                const driftX = Math.sin(time * 0.3 + ud.phaseX) * (diagonal * 0.05);
                                const driftY = Math.cos(time * 0.25 + ud.phaseY) * (diagonal * 0.05);
                                const driftZ = Math.sin(time * 0.2 + ud.phaseZ) * (diagonal * 0.05);

                                const scaleFluctuation = 1.0 + Math.sin(time * 0.15 + ud.phaseScale) * 0.08;
                                const currentScale = ud.baseScale * scaleFluctuation;
                                sprite.scale.set(currentScale, currentScale, 1);

                                const pushBackDist = 55;
                                sprite.position.set(
                                    nx + ud.offsetX + driftX + camDir.x * pushBackDist,
                                    ny + ud.offsetY + driftY + camDir.y * pushBackDist,
                                    nz + ud.offsetZ + driftZ + camDir.z * pushBackDist
                                );
                                const mat = sprite.material as THREE.SpriteMaterial;
                                mat.rotation = ud.baseRotation + time * ud.rotSpeed;
                            });
                        }
                    });

                    // 脱退したノードのスプライトを削除
                    visualObj.nodeBubbles.forEach((bubbleSprites, id) => {
                        if (!activeNodeIds.has(id)) {
                            bubbleSprites.forEach(sprite => {
                                scene.remove(sprite);
                                if (sprite.material) (sprite.material as THREE.Material).dispose();
                            });
                            visualObj!.nodeBubbles.delete(id);
                        }
                    });

                    // --- 2. リンクに沿ってまとわりつくスプライトトレイル (Link Tubes) の管理 ---
                    const groupNodeIds = new Set(nodesInGroup.map(n => n.id));
                    const linksInGroup = graphData.links.filter(l => 
                        l.source && l.target && 
                        groupNodeIds.has(l.source.id) && 
                        groupNodeIds.has(l.target.id) &&
                        isLinkVisible(l)
                    );

                    const activeLinkKeys = new Set<string>();
                    linksInGroup.forEach(link => {
                        const key = `${link.source.id}-${link.target.id}`;
                        activeLinkKeys.add(key);

                        let tubes = visualObj!.linkTubes.get(key);

                        const sPos = new THREE.Vector3(link.source.x ?? 0, link.source.y ?? 0, link.source.z ?? 0);
                        const tPos = new THREE.Vector3(link.target.x ?? 0, link.target.y ?? 0, link.target.z ?? 0);

                        const spriteCount = 3;

                        if (!tubes && cloudTexture) {
                            tubes = [];
                            for (let i = 0; i < spriteCount; i++) {
                                const mat = new THREE.SpriteMaterial({
                                    map: cloudTexture,
                                    color: new THREE.Color(hexColor),
                                    transparent: true,
                                    opacity: 0.08,
                                    depthWrite: false
                                });
                                mat.rotation = Math.random() * Math.PI * 2;

                                const sprite = new THREE.Sprite(mat);
                                const tubeScale = 220 + Math.random() * 100;
                                sprite.scale.set(tubeScale, tubeScale, 1);
                                
                                sprite.userData = {
                                    baseRotation: mat.rotation,
                                    rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.005 + Math.random() * 0.015),
                                    offsetX: (Math.random() - 0.5) * 15,
                                    offsetY: (Math.random() - 0.5) * 15,
                                    offsetZ: (Math.random() - 0.5) * 15,
                                    baseScale: tubeScale,
                                    phaseX: Math.random() * Math.PI * 2,
                                    phaseY: Math.random() * Math.PI * 2,
                                    phaseZ: Math.random() * Math.PI * 2,
                                    phaseScale: Math.random() * Math.PI * 2
                                };

                                scene.add(sprite);
                                tubes.push(sprite);
                            }
                            visualObj!.linkTubes.set(key, tubes);
                        } else if (tubes) {
                            tubes.forEach(sprite => {
                                const mat = sprite.material as THREE.SpriteMaterial;
                                if (mat.color.getHexString() !== new THREE.Color(hexColor).getHexString()) {
                                    mat.color.set(hexColor);
                                }
                            });
                        }

                        if (tubes) {
                            const time = performance.now() * 0.001;
                            for (let i = 0; i < spriteCount; i++) {
                                const t = (i + 1) * (1.0 / (spriteCount + 1));
                                const pos = new THREE.Vector3().lerpVectors(sPos, tPos, t);
                                
                                const sprite = tubes[i];
                                const ud = sprite.userData;
                                
                                const driftX = Math.sin(time * 0.4 + ud.phaseX) * 6;
                                const driftY = Math.cos(time * 0.35 + ud.phaseY) * 6;
                                const driftZ = Math.sin(time * 0.3 + ud.phaseZ) * 6;

                                const scaleFluctuation = 1.0 + Math.sin(time * 0.2 + ud.phaseScale) * 0.06;
                                const currentScale = ud.baseScale * scaleFluctuation;
                                sprite.scale.set(currentScale, currentScale, 1);

                                const pushBackDist = 35;
                                sprite.position.set(
                                    pos.x + ud.offsetX + driftX + camDir.x * pushBackDist,
                                    pos.y + ud.offsetY + driftY + camDir.y * pushBackDist,
                                    pos.z + ud.offsetZ + driftZ + camDir.z * pushBackDist
                                );

                                const mat = sprite.material as THREE.SpriteMaterial;
                                mat.rotation = ud.baseRotation + time * ud.rotSpeed;
                            }
                        }
                    });

                    // 切断されたリンクのスプライト群を削除
                    visualObj.linkTubes.forEach((tubes, key) => {
                        if (!activeLinkKeys.has(key)) {
                            tubes.forEach(sprite => {
                                scene.remove(sprite);
                                if (sprite.material) (sprite.material as THREE.Material).dispose();
                            });
                            visualObj!.linkTubes.delete(key);
                        }
                    });
                }

            });

            // 削除されたグループの3Dオブジェクト一式をクリーンアップ
            groupVisualsRef.current.forEach((visualObj, id) => {
                if (!activeGroupIds.has(id)) {
                    if (visualObj.sprite) scene.remove(visualObj.sprite);
                    visualObj.nodeBubbles.forEach(bubbleSprites => {
                        bubbleSprites.forEach(sprite => {
                            scene.remove(sprite);
                            if (sprite.material) (sprite.material as THREE.Material).dispose();
                        });
                    });
                    visualObj.linkTubes.forEach(tubes => {
                        tubes.forEach(sprite => {
                            scene.remove(sprite);
                            if (sprite.material) (sprite.material as THREE.Material).dispose();
                        });
                    });
                    groupVisualsRef.current.delete(id);
                }
            });

            // --- 4. 発光オーラ (スプライトベースのグロウ) の管理 ---
            const currentAuraNodeKeys = new Set<string>();

            groups.forEach((group: any) => {
                if (group.shape === 'aura') {
                    const descendantIds = getDescendantIds(group.id, graphData.nodes, graphData.links);
                    const nodesInGroup = graphData.nodes.filter(n => descendantIds.has(n.id) && isNodeVisible(n));

                    const hexColor = group.color || '#4c9ac0';

                    nodesInGroup.forEach(node => {
                        const auraKey = `aura_${group.id}_${node.id}`;
                        currentAuraNodeKeys.add(auraKey);

                        let auraSprite = auraSpritesRef.current.get(auraKey);

                        if (!auraSprite) {
                            // ラジアルグラデーションでグロウテクスチャを生成
                            const canvas = document.createElement('canvas');
                            canvas.width = 256;
                            canvas.height = 256;
                            const ctx = canvas.getContext('2d')!;

                            // 色をパース
                            const tmpColor = new THREE.Color(hexColor);
                            const r = Math.round(tmpColor.r * 255);
                            const g = Math.round(tmpColor.g * 255);
                            const b = Math.round(tmpColor.b * 255);

                            const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
                            gradient.addColorStop(0, `rgba(${r},${g},${b},0.7)`);
                            gradient.addColorStop(0.3, `rgba(${r},${g},${b},0.35)`);
                            gradient.addColorStop(0.6, `rgba(${r},${g},${b},0.12)`);
                            gradient.addColorStop(0.8, `rgba(${r},${g},${b},0)`);
                            ctx.fillStyle = gradient;
                            ctx.fillRect(0, 0, 256, 256);

                            const texture = new THREE.CanvasTexture(canvas);
                            const mat = new THREE.SpriteMaterial({
                                map: texture,
                                blending: THREE.AdditiveBlending,
                                transparent: true,
                                depthWrite: false,
                                depthTest: true,
                            });
                            auraSprite = new THREE.Sprite(mat);
                            auraSprite.renderOrder = -1; // 雲やノードの裏側に配置
                            scene.add(auraSprite);
                            auraSpritesRef.current.set(auraKey, auraSprite);
                        }

                        // ノード位置に追従
                        const nx = node.x ?? 0;
                        const ny = node.y ?? 0;
                        const nz = node.z ?? 0;
                        auraSprite.position.set(nx, ny, nz);

                        // ノードサイズに合わせてグロウサイズを調整 (ノードの約1.8倍)
                        const cache = htmlNodeCache.current.get(node.id);
                        let sizeX = 200;
                        let sizeY = 120;
                        if (cache && cache.hitBox) {
                            sizeX = cache.hitBox.scale.x;
                            sizeY = cache.hitBox.scale.y;
                        } else if ((node as any).__threeObj) {
                            const obj = (node as any).__threeObj;
                            const box = new THREE.Box3().setFromObject(obj);
                            const boxSize = new THREE.Vector3();
                            box.getSize(boxSize);
                            sizeX = boxSize.x || 200;
                            sizeY = boxSize.y || 120;
                        }

                        const glowScale = 3;
                        const maxDim = Math.max(sizeX, sizeY) * glowScale;
                        auraSprite.scale.set(maxDim, maxDim, 1);

                        // カメラの裏に回り込まないよう少し奥に押し出す
                        const pushBack = camDir.clone().multiplyScalar(10);
                        auraSprite.position.add(pushBack);
                    });
                }
            });

            // 不要になったオーラスプライトをクリーンアップ
            auraSpritesRef.current.forEach((sprite, key) => {
                if (!currentAuraNodeKeys.has(key)) {
                    scene.remove(sprite);
                    if (sprite.material) {
                        (sprite.material as THREE.SpriteMaterial).map?.dispose();
                        (sprite.material as THREE.Material).dispose();
                    }
                    auraSpritesRef.current.delete(key);
                }
            });

            animationFrameId = requestAnimationFrame(updateGroups);
        };

        animationFrameId = requestAnimationFrame(updateGroups);
        return () => {
            cancelAnimationFrame(animationFrameId);
            const scene = fgRef.current?.scene();

            // オーラスプライトのクリーンアップ
            auraSpritesRef.current.forEach((sprite) => {
                if (scene) scene.remove(sprite);
                if (sprite.material) {
                    (sprite.material as THREE.SpriteMaterial).map?.dispose();
                    (sprite.material as THREE.Material).dispose();
                }
            });
            auraSpritesRef.current.clear();

            if (scene) {
                groupVisualsRef.current.forEach(visualObj => {
                    if (visualObj.sprite) scene.remove(visualObj.sprite);
                    visualObj.nodeBubbles.forEach(bubbleSprites => {
                        bubbleSprites.forEach(sprite => {
                            scene.remove(sprite);
                            if (sprite.material) (sprite.material as THREE.Material).dispose();
                        });
                    });
                    visualObj.linkTubes.forEach(tubes => {
                        tubes.forEach(sprite => {
                            scene.remove(sprite);
                            if (sprite.material) (sprite.material as THREE.Material).dispose();
                        });
                    });
                });
            }
            groupVisualsRef.current.clear();
        };
    }, [graphData, cloudTexture, fgRef, htmlNodeCache]);

    return groupVisualsRef;
};
