import { describe, it, expect, beforeEach } from 'vitest';
import { useMainStore } from '@/store/mainStore';
import type { Artwork, RelayoutPreviewResponse, Point3D } from '@/types';

const makeArtwork = (id: string, x: number, y: number, z: number): Artwork => ({
  id,
  galleryId: 'g1',
  registrationNo: `REG-${id}`,
  name: `作品-${id}`,
  lightResistanceGrade: 'ISO 15426 Grade 1',
  posX: x,
  posY: y,
  posZ: z,
  width: 0.5,
  height: 0.4,
  protectionLevel: 'A级',
  createdBy: 'tester',
  createdAt: new Date().toISOString()
});

const makePreview = (artworkId: string, orig: Point3D, next: Point3D): RelayoutPreviewResponse => ({
  artworkId,
  originalPosition: orig,
  newPosition: next,
  originalIllumination: 100,
  newIllumination: 60,
  originalRiskLevel: 'high',
  newRiskLevel: 'low',
  improvement: 0.4,
  recommendation: '建议确认',
  warnings: []
});

describe('换位预览闭环 store 测试', () => {
  beforeEach(() => {
    useMainStore.getState().resetData();
  });

  it('confirmRelayout 应保持作品在新位置，清除预览状态', () => {
    const store = useMainStore.getState();
    const origPos: Point3D = { x: 1, y: 1.5, z: 2 };
    const newPos: Point3D = { x: 3, y: 1.5, z: 4 };
    const artwork = makeArtwork('a1', origPos.x, origPos.y, origPos.z);

    store.addArtwork(artwork, 'key-1');
    store.setDraggingArtworkId('a1');
    store.setOriginalPosition(origPos);
    store.updateArtworkPosition('a1', newPos);
    store.setRelayoutPreview(makePreview('a1', origPos, newPos));

    const beforeConfirm = useMainStore.getState();
    expect(beforeConfirm.relayoutPreview).not.toBeNull();
    expect(beforeConfirm.originalPosition).toEqual(origPos);
    expect(beforeConfirm.artworks[0].posX).toBe(3);

    useMainStore.getState().confirmRelayout();

    const afterConfirm = useMainStore.getState();
    expect(afterConfirm.relayoutPreview).toBeNull();
    expect(afterConfirm.originalPosition).toBeNull();
    expect(afterConfirm.draggingArtworkId).toBeNull();
    expect(afterConfirm.isRelayoutConfirmMode).toBe(false);
    expect(afterConfirm.artworks[0].posX).toBe(3);
    expect(afterConfirm.artworks[0].posY).toBe(1.5);
    expect(afterConfirm.artworks[0].posZ).toBe(4);
  });

  it('cancelRelayout 应恢复作品到原位置，清除预览状态', () => {
    const store = useMainStore.getState();
    const origPos: Point3D = { x: 1, y: 1.5, z: 2 };
    const newPos: Point3D = { x: 3, y: 1.5, z: 4 };
    const artwork = makeArtwork('a2', origPos.x, origPos.y, origPos.z);

    store.addArtwork(artwork, 'key-2');
    store.setDraggingArtworkId('a2');
    store.setOriginalPosition(origPos);
    store.updateArtworkPosition('a2', newPos);
    store.setRelayoutPreview(makePreview('a2', origPos, newPos));

    expect(useMainStore.getState().artworks[0].posX).toBe(3);

    useMainStore.getState().cancelRelayout();

    const afterCancel = useMainStore.getState();
    expect(afterCancel.relayoutPreview).toBeNull();
    expect(afterCancel.originalPosition).toBeNull();
    expect(afterCancel.draggingArtworkId).toBeNull();
    expect(afterCancel.isRelayoutConfirmMode).toBe(false);
    expect(afterCancel.artworks[0].posX).toBe(1);
    expect(afterCancel.artworks[0].posY).toBe(1.5);
    expect(afterCancel.artworks[0].posZ).toBe(2);
  });

  it('confirmRelayout 无预览时应为空操作', () => {
    const store = useMainStore.getState();
    const artwork = makeArtwork('a3', 1, 2, 3);
    store.addArtwork(artwork, 'key-3');

    useMainStore.getState().confirmRelayout();

    const after = useMainStore.getState();
    expect(after.artworks[0].posX).toBe(1);
    expect(after.relayoutPreview).toBeNull();
  });

  it('cancelRelayout 无预览时只清状态不崩溃', () => {
    const store = useMainStore.getState();
    const artwork = makeArtwork('a4', 5, 6, 7);
    store.addArtwork(artwork, 'key-4');
    store.setDraggingArtworkId('a4');
    store.setOriginalPosition({ x: 5, y: 6, z: 7 });

    useMainStore.getState().cancelRelayout();

    const after = useMainStore.getState();
    expect(after.relayoutPreview).toBeNull();
    expect(after.draggingArtworkId).toBeNull();
    expect(after.artworks[0].posX).toBe(5);
  });

  it('setRelayoutMode 退出时应清除所有预览相关状态', () => {
    const store = useMainStore.getState();
    const artwork = makeArtwork('a5', 1, 1, 1);
    store.addArtwork(artwork, 'key-5');
    store.setRelayoutMode(true);
    store.setDraggingArtworkId('a5');
    store.setOriginalPosition({ x: 1, y: 1, z: 1 });
    store.setRelayoutPreview(makePreview('a5', { x: 1, y: 1, z: 1 }, { x: 2, y: 2, z: 2 }));

    expect(useMainStore.getState().isRelayoutMode).toBe(true);
    expect(useMainStore.getState().relayoutPreview).not.toBeNull();

    useMainStore.getState().setRelayoutMode(false);

    const after = useMainStore.getState();
    expect(after.isRelayoutMode).toBe(false);
    expect(after.relayoutPreview).toBeNull();
    expect(after.draggingArtworkId).toBeNull();
    expect(after.originalPosition).toBeNull();
    expect(after.isRelayoutConfirmMode).toBe(false);
  });

  it('连续换位：第一次确认后再换第二次，应正确记录', () => {
    const store = useMainStore.getState();
    const orig1: Point3D = { x: 0, y: 1.5, z: 0 };
    const next1: Point3D = { x: 2, y: 1.5, z: 2 };
    const artwork = makeArtwork('a6', orig1.x, orig1.y, orig1.z);

    store.addArtwork(artwork, 'key-6a');
    store.setDraggingArtworkId('a6');
    store.setOriginalPosition(orig1);
    store.updateArtworkPosition('a6', next1);
    store.setRelayoutPreview(makePreview('a6', orig1, next1));
    useMainStore.getState().confirmRelayout();

    expect(useMainStore.getState().artworks[0].posX).toBe(2);
    expect(useMainStore.getState().relayoutPreview).toBeNull();

    const orig2: Point3D = { x: 2, y: 1.5, z: 2 };
    const next2: Point3D = { x: -1, y: 1.5, z: 3 };
    const store2 = useMainStore.getState();
    store2.setDraggingArtworkId('a6');
    store2.setOriginalPosition(orig2);
    store2.updateArtworkPosition('a6', next2);
    store2.setRelayoutPreview(makePreview('a6', orig2, next2));

    expect(useMainStore.getState().artworks[0].posX).toBe(-1);

    useMainStore.getState().confirmRelayout();
    expect(useMainStore.getState().artworks[0].posX).toBe(-1);
    expect(useMainStore.getState().artworks[0].posZ).toBe(3);
  });

  it('换位后取消再换位：取消应精确回到上一次确认的位置', () => {
    const store = useMainStore.getState();
    const confirmed: Point3D = { x: 5, y: 1.5, z: 5 };
    const artwork = makeArtwork('a7', confirmed.x, confirmed.y, confirmed.z);

    store.addArtwork(artwork, 'key-7');
    store.setDraggingArtworkId('a7');
    store.setOriginalPosition(confirmed);
    store.updateArtworkPosition('a7', { x: 10, y: 1.5, z: 10 });
    store.setRelayoutPreview(makePreview('a7', confirmed, { x: 10, y: 1.5, z: 10 }));

    expect(useMainStore.getState().artworks[0].posX).toBe(10);

    useMainStore.getState().cancelRelayout();

    expect(useMainStore.getState().artworks[0].posX).toBe(5);
    expect(useMainStore.getState().artworks[0].posZ).toBe(5);
    expect(useMainStore.getState().relayoutPreview).toBeNull();
  });
});
