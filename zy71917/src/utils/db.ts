import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type {
  Project,
  SubtitleTrack,
  SubtitleEntry,
  EditPoint,
  AlignmentIssue,
  Segment,
  AdjustmentRecord,
} from "@/types";

interface PodcastAlignerDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  tracks: {
    key: string;
    value: SubtitleTrack;
    indexes: { "by-project": string };
  };
  entries: {
    key: string;
    value: SubtitleEntry;
    indexes: { "by-track": string };
  };
  editPoints: {
    key: string;
    value: EditPoint;
    indexes: { "by-project": string };
  };
  issues: {
    key: string;
    value: AlignmentIssue;
    indexes: { "by-project": string };
  };
  segments: {
    key: string;
    value: Segment;
    indexes: { "by-project": string };
  };
  adjustments: {
    key: string;
    value: AdjustmentRecord;
    indexes: { "by-entry": string };
  };
}

let dbInstance: IDBPDatabase<PodcastAlignerDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<PodcastAlignerDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PodcastAlignerDB>("podcast-aligner", 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });

      const trackStore = db.createObjectStore("tracks", { keyPath: "id" });
      trackStore.createIndex("by-project", "projectId");

      const entryStore = db.createObjectStore("entries", { keyPath: "id" });
      entryStore.createIndex("by-track", "trackId");

      const editPointStore = db.createObjectStore("editPoints", {
        keyPath: "id",
      });
      editPointStore.createIndex("by-project", "projectId");

      const issueStore = db.createObjectStore("issues", { keyPath: "id" });
      issueStore.createIndex("by-project", "projectId");

      const segmentStore = db.createObjectStore("segments", { keyPath: "id" });
      segmentStore.createIndex("by-project", "projectId");

      const adjustmentStore = db.createObjectStore("adjustments", {
        keyPath: "id",
      });
      adjustmentStore.createIndex("by-entry", "entryId");
    },
  });

  return dbInstance;
}

export async function saveProject(project: Project): Promise<void> {
  const db = await initDB();
  await db.put("projects", project);
}

export async function getProject(
  id: string
): Promise<Project | undefined> {
  const db = await initDB();
  return db.get("projects", id);
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await initDB();
  return db.getAll("projects");
}

export async function deleteProject(id: string): Promise<void> {
  const db = await initDB();
  await db.delete("projects", id);
}

export async function saveTrack(track: SubtitleTrack): Promise<void> {
  const db = await initDB();
  await db.put("tracks", track);
}

export async function getTracksByProject(
  projectId: string
): Promise<SubtitleTrack[]> {
  const db = await initDB();
  return db.getAllFromIndex("tracks", "by-project", projectId);
}

export async function saveEntries(entries: SubtitleEntry[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction("entries", "readwrite");
  for (const entry of entries) {
    await tx.store.put(entry);
  }
  await tx.done;
}

export async function getEntriesByTrack(
  trackId: string
): Promise<SubtitleEntry[]> {
  const db = await initDB();
  return db.getAllFromIndex("entries", "by-track", trackId);
}

export async function saveEditPoint(point: EditPoint): Promise<void> {
  const db = await initDB();
  await db.put("editPoints", point);
}

export async function getEditPointsByProject(
  projectId: string
): Promise<EditPoint[]> {
  const db = await initDB();
  return db.getAllFromIndex("editPoints", "by-project", projectId);
}

export async function deleteEditPoint(id: string): Promise<void> {
  const db = await initDB();
  await db.delete("editPoints", id);
}

export async function saveIssue(issue: AlignmentIssue): Promise<void> {
  const db = await initDB();
  await db.put("issues", issue);
}

export async function getIssuesByProject(
  projectId: string
): Promise<AlignmentIssue[]> {
  const db = await initDB();
  return db.getAllFromIndex("issues", "by-project", projectId);
}

export async function saveSegment(segment: Segment): Promise<void> {
  const db = await initDB();
  await db.put("segments", segment);
}

export async function getSegmentsByProject(
  projectId: string
): Promise<Segment[]> {
  const db = await initDB();
  return db.getAllFromIndex("segments", "by-project", projectId);
}

export async function saveAdjustment(record: AdjustmentRecord): Promise<void> {
  const db = await initDB();
  await db.put("adjustments", record);
}

export async function getAdjustmentsByEntry(
  entryId: string
): Promise<AdjustmentRecord[]> {
  const db = await initDB();
  return db.getAllFromIndex("adjustments", "by-entry", entryId);
}

export async function getAllAdjustmentsByProject(
  projectId: string
): Promise<AdjustmentRecord[]> {
  const db = await initDB();
  const tracks = await db.getAllFromIndex("tracks", "by-project", projectId);
  const allAdjustments: AdjustmentRecord[] = [];

  for (const track of tracks) {
    const entries = await db.getAllFromIndex("entries", "by-track", track.id);
    for (const entry of entries) {
      const adjustments = await db.getAllFromIndex(
        "adjustments",
        "by-entry",
        entry.id
      );
      allAdjustments.push(...adjustments);
    }
  }

  return allAdjustments;
}
