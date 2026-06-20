import type { Plugin } from 'vite';
import { URL } from 'node:url';
import { useManifestStore } from '../store/manifestStore';

const DATA_SOURCE_NOTE =
  '页面展示、接口返回、导出明细 均读取同一份Store状态，此响应体即接口返回的完整数据';

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function notFoundResponse() {
  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function mockApiPlugin(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          next();
          return;
        }

        const parsed = new URL(req.url, 'http://localhost');
        const pathname = parsed.pathname;

        const state = useManifestStore.getState();
        const timestamp = new Date().toISOString();

        const manifestIdMatch = pathname.match(
          /^\/api\/manifests\/([^/]+)(?:\/(conflicts|override-history))?$/
        );

        if (pathname === '/api/manifests') {
          const manifests = state.manifests.map((m) => {
            const unresolved = state.getUnresolvedConflictsByManifestId(m.id);
            const overridden = state.getOverriddenFieldsByManifestId(m.id);
            const resolved = state.getResolvedConflictsByManifestId(m.id);
            return {
              ...m,
              unresolvedConflictCount: unresolved.length,
              overriddenFieldCount: overridden.length,
              resolvedConflictCount: resolved.length,
              fieldCount:
                m.supplementFields.length || m.ocrFields.length,
            };
          });

          const body = jsonResponse({
            dataSourceNote: DATA_SOURCE_NOTE,
            responseTimestamp: timestamp,
            data: manifests,
          });
          body.headers.forEach((v, k) => res.setHeader(k, v));
          res.statusCode = body.status;
          res.end(await body.text());
          return;
        }

        if (manifestIdMatch) {
          const id = manifestIdMatch[1];
          const subRoute = manifestIdMatch[2];

          if (subRoute === 'conflicts') {
            const conflicts =
              state.getAllConflictsByManifestId(id);
            const body = jsonResponse({
              dataSourceNote: DATA_SOURCE_NOTE,
              responseTimestamp: timestamp,
              data: conflicts,
            });
            body.headers.forEach((v, k) => res.setHeader(k, v));
            res.statusCode = body.status;
            res.end(await body.text());
            return;
          }

          if (subRoute === 'override-history') {
            const history =
              state.getOverrideHistoryByManifestId(id);
            const body = jsonResponse({
              dataSourceNote: DATA_SOURCE_NOTE,
              responseTimestamp: timestamp,
              data: history,
            });
            body.headers.forEach((v, k) => res.setHeader(k, v));
            res.statusCode = body.status;
            res.end(await body.text());
            return;
          }

          const manifest = state.getManifestById(id);
          if (!manifest) {
            const body = notFoundResponse();
            body.headers.forEach((v, k) => res.setHeader(k, v));
            res.statusCode = body.status;
            res.end(await body.text());
            return;
          }

          const unresolved =
            state.getUnresolvedConflictsByManifestId(id);
          const overridden =
            state.getOverriddenFieldsByManifestId(id);
          const resolved =
            state.getResolvedConflictsByManifestId(id);

          const body = jsonResponse({
            dataSourceNote: DATA_SOURCE_NOTE,
            responseTimestamp: timestamp,
            data: {
              ...manifest,
              unresolvedConflictCount: unresolved.length,
              overriddenFieldCount: overridden.length,
              resolvedConflictCount: resolved.length,
              conflicts: state.getAllConflictsByManifestId(id),
              overrideHistory:
                state.getOverrideHistoryByManifestId(id),
              knowledgeReferences:
                state.getKnowledgeByManifestId(id),
              tickets: state.getTicketsByManifestId(id),
            },
          });
          body.headers.forEach((v, k) => res.setHeader(k, v));
          res.statusCode = body.status;
          res.end(await body.text());
          return;
        }

        if (pathname === '/api/self-check') {
          state.runSelfCheck();
          const body = jsonResponse({
            dataSourceNote: DATA_SOURCE_NOTE,
            responseTimestamp: timestamp,
            data: state.selfCheckResults,
          });
          body.headers.forEach((v, k) => res.setHeader(k, v));
          res.statusCode = body.status;
          res.end(await body.text());
          return;
        }

        if (pathname === '/api/export') {
          const body = jsonResponse({
            dataSourceNote: DATA_SOURCE_NOTE,
            responseTimestamp: timestamp,
            data: state.getExportData(),
          });
          body.headers.forEach((v, k) => res.setHeader(k, v));
          res.statusCode = body.status;
          res.end(await body.text());
          return;
        }

        if (pathname === '/api/evaluation') {
          const totalManifests = state.manifests.length;
          const totalConflicts = state.conflicts.length;
          const unresolvedConflicts = state.conflicts.filter(
            (c) =>
              c.status === 'pending' || c.status === 'deferred'
          ).length;
          const resolvedConflicts = totalConflicts - unresolvedConflicts;
          const overriddenFields =
            state.overrideHistory.filter((o) => o.wasOverridden)
              .length;
          const protectedOverrides =
            state.overrideHistory.filter(
              (o) => o.isProtected && !o.wasOverridden
            ).length;

          const body = jsonResponse({
            dataSourceNote: DATA_SOURCE_NOTE,
            responseTimestamp: timestamp,
            data: {
              totalManifests,
              totalConflicts,
              unresolvedConflicts,
              resolvedConflicts,
              overriddenFields,
              protectedOverrides,
              conflictResolutionRate:
                totalConflicts > 0
                  ? +(resolvedConflicts / totalConflicts * 100).toFixed(1)
                  : 0,
            },
          });
          body.headers.forEach((v, k) => res.setHeader(k, v));
          res.statusCode = body.status;
          res.end(await body.text());
          return;
        }

        const body = notFoundResponse();
        body.headers.forEach((v, k) => res.setHeader(k, v));
        res.statusCode = body.status;
        res.end(await body.text());
      });
    },
  };
}
