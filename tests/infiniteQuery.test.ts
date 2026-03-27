import { describe, expect, it, vi } from "vitest";
import { infiniteQuery } from "../src/data/infiniteQuery";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("infiniteQuery", () => {
  it("fetches the initial page", async () => {
    const query = infiniteQuery(
      "test",
      async ({ pageParam }) => ({ items: [`item-${pageParam}`], nextCursor: pageParam + 1 }),
      { getNextPageParam: (last) => last.nextCursor, initialPageParam: 0 },
    );

    expect(query.loading()).toBe(true);
    await tick();

    expect(query.loading()).toBe(false);
    expect(query.pages()).toHaveLength(1);
    expect(query.pages()[0].items).toEqual(["item-0"]);
    expect(query.hasNextPage()).toBe(true);

    query.dispose();
  });

  it("fetches next pages sequentially", async () => {
    const query = infiniteQuery(
      "pages",
      async ({ pageParam }: { pageParam: number; signal: AbortSignal }) => ({
        items: [pageParam],
        next: pageParam < 2 ? pageParam + 1 : undefined,
      }),
      {
        getNextPageParam: (last) => last.next,
        initialPageParam: 0,
      },
    );

    await tick();
    expect(query.pages()).toHaveLength(1);

    await query.fetchNextPage();
    expect(query.pages()).toHaveLength(2);
    expect(query.pages()[1].items).toEqual([1]);

    await query.fetchNextPage();
    expect(query.pages()).toHaveLength(3);
    expect(query.hasNextPage()).toBe(false);

    query.dispose();
  });

  it("signals no more pages via hasNextPage", async () => {
    const query = infiniteQuery("end", async () => ({ data: "only-page", next: undefined as number | undefined }), {
      getNextPageParam: (last) => last.next,
      initialPageParam: 0,
    });

    await tick();
    expect(query.hasNextPage()).toBe(false);
    expect(query.pages()).toHaveLength(1);

    query.dispose();
  });

  it("handles errors", async () => {
    const query = infiniteQuery(
      "err",
      async () => {
        throw new Error("fetch failed");
      },
      {
        getNextPageParam: () => undefined,
        initialPageParam: 0,
        retry: { maxRetries: 0 },
      },
    );

    await tick();
    expect(query.error()?.message).toBe("fetch failed");
    expect(query.loading()).toBe(false);

    query.dispose();
  });

  it("refetches from scratch", async () => {
    let fetchCount = 0;
    const query = infiniteQuery(
      "refetch",
      async ({ pageParam }: { pageParam: number; signal: AbortSignal }) => {
        fetchCount++;
        return { data: `page-${pageParam}-v${fetchCount}`, next: undefined as number | undefined };
      },
      { getNextPageParam: (last) => last.next, initialPageParam: 0 },
    );

    await tick();
    expect(query.pages()[0].data).toBe("page-0-v1");

    await query.refetch();
    expect(query.pages()[0].data).toBe("page-0-v2");
    expect(query.pages()).toHaveLength(1);

    query.dispose();
  });

  it("calls onSuccess and onError callbacks", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const query = infiniteQuery("callbacks", async () => ({ items: [1] }), {
      getNextPageParam: () => undefined,
      initialPageParam: 0,
      onSuccess,
      onError,
    });

    await tick();
    expect(onSuccess).toHaveBeenCalledWith([{ items: [1] }]);
    expect(onError).not.toHaveBeenCalled();

    query.dispose();
  });

  it("does not fetch when enabled is false", async () => {
    const fn = vi.fn().mockResolvedValue({ items: [] });
    const query = infiniteQuery("disabled", fn, {
      getNextPageParam: () => undefined,
      initialPageParam: 0,
      enabled: false,
    });

    await tick();
    expect(fn).not.toHaveBeenCalled();
    expect(query.loading()).toBe(false);

    query.dispose();
  });
});
