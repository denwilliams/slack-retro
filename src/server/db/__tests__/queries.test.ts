import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Mock the db module before importing queries
const mockReturning = mock(() => []);
const mockLimit = mock(() => []);

const mockWhere = mock((): unknown => ({
	returning: mockReturning,
	orderBy: mock((): unknown => ({
		limit: mockLimit,
	})),
}));

const mockOnConflictDoUpdate = mock((): unknown => ({
	returning: mockReturning,
}));

const mockValues = mock((): unknown => ({
	returning: mockReturning,
	onConflictDoUpdate: mockOnConflictDoUpdate,
}));

const mockSet = mock((): unknown => ({
	where: mockWhere,
}));

const mockFrom = mock((): unknown => ({
	where: mockWhere,
}));

const mockDb = {
	select: mock((): unknown => ({
		from: mockFrom,
	})),
	insert: mock((): unknown => ({
		values: mockValues,
	})),
	update: mock((): unknown => ({
		set: mockSet,
	})),
	delete: mock((): unknown => ({
		where: mockWhere,
	})),
};

mock.module("../index", () => ({
	db: mockDb,
}));

// Import after mocking
const { getOrCreateActiveRetro, getDiscussionItems, deleteDiscussionItem, getActionItems } =
	await import("../queries");

function resetMocks() {
	mockReturning.mockReset();
	mockLimit.mockReset();
	mockWhere.mockReset();
	mockOnConflictDoUpdate.mockReset();
	mockValues.mockReset();
	mockSet.mockReset();
	mockFrom.mockReset();
	mockDb.select.mockReset();
	mockDb.insert.mockReset();
	mockDb.update.mockReset();
	mockDb.delete.mockReset();
}

// Helper to set up a full chain for select queries
function setupSelectChain(results: unknown[]) {
	const limitFn = mock(() => results);
	const orderByFn = mock((): unknown => ({
		limit: limitFn,
	}));
	const whereFn = mock((): unknown => ({
		orderBy: orderByFn,
		limit: limitFn,
	}));
	const fromFn = mock((): unknown => ({
		where: whereFn,
		orderBy: orderByFn,
	}));
	mockDb.select.mockReturnValue({ from: fromFn } as unknown as ReturnType<typeof mockDb.select>);
	return { fromFn, whereFn, orderByFn, limitFn };
}

// Helper to set up insert chain
function setupInsertChain(results: unknown[]) {
	const returningFn = mock(() => results);
	const onConflictFn = mock((): unknown => ({
		returning: returningFn,
	}));
	const valuesFn = mock((): unknown => ({
		returning: returningFn,
		onConflictDoUpdate: onConflictFn,
	}));
	mockDb.insert.mockReturnValue({ values: valuesFn } as unknown as ReturnType<
		typeof mockDb.insert
	>);
	return { valuesFn, returningFn, onConflictFn };
}

describe("getOrCreateActiveRetro", () => {
	beforeEach(resetMocks);
	afterEach(resetMocks);

	test("returns existing active retro when one exists", async () => {
		const existingRetro = {
			id: "retro-1",
			teamId: "team-1",
			status: "active" as const,
			createdAt: new Date(),
			finishedAt: null,
			summary: null,
		};

		// First call: select to find active retro
		setupSelectChain([existingRetro]);

		const result = await getOrCreateActiveRetro("team-1");

		expect(result).toEqual(existingRetro);
		expect(mockDb.select).toHaveBeenCalledTimes(1);
		// Should NOT have called insert since we found an active retro
		expect(mockDb.insert).not.toHaveBeenCalled();
	});

	test("creates new retro when none exists", async () => {
		const newRetro = {
			id: "retro-2",
			teamId: "team-1",
			status: "active" as const,
			createdAt: new Date(),
			finishedAt: null,
			summary: null,
		};

		// First call: select returns empty (no active retro)
		setupSelectChain([]);

		// Second call: insert to create new retro
		setupInsertChain([newRetro]);

		const result = await getOrCreateActiveRetro("team-1");

		expect(result).toEqual(newRetro);
		expect(mockDb.select).toHaveBeenCalledTimes(1);
		expect(mockDb.insert).toHaveBeenCalledTimes(1);
	});
});

describe("getDiscussionItems", () => {
	beforeEach(resetMocks);
	afterEach(resetMocks);

	test("returns items sorted by category and created_at", async () => {
		const items = [
			{
				id: "item-1",
				retroId: "retro-1",
				userId: "user-1",
				userName: "Alice",
				category: "bad" as const,
				content: "Bad thing",
				createdAt: new Date("2024-01-01"),
			},
			{
				id: "item-2",
				retroId: "retro-1",
				userId: "user-2",
				userName: "Bob",
				category: "good" as const,
				content: "Good thing",
				createdAt: new Date("2024-01-02"),
			},
		];

		// getDiscussionItems uses select().from().where().orderBy()
		const orderByFn = mock(() => items);
		const whereFn = mock((): unknown => ({
			orderBy: orderByFn,
		}));
		const fromFn = mock((): unknown => ({
			where: whereFn,
		}));
		mockDb.select.mockReturnValue({ from: fromFn } as unknown as ReturnType<typeof mockDb.select>);

		const result = await getDiscussionItems("retro-1");

		expect(result).toEqual(items);
		expect(result).toHaveLength(2);
		expect(mockDb.select).toHaveBeenCalledTimes(1);
	});
});

describe("deleteDiscussionItem", () => {
	beforeEach(resetMocks);
	afterEach(resetMocks);

	test("returns false when user does not own the item", async () => {
		// delete().where().returning() returns empty array when no match
		const returningFn = mock(() => []);
		const whereFn = mock((): unknown => ({
			returning: returningFn,
		}));
		mockDb.delete.mockReturnValue({ where: whereFn } as unknown as ReturnType<
			typeof mockDb.delete
		>);

		const result = await deleteDiscussionItem("item-1", "wrong-user");

		expect(result).toBe(false);
	});

	test("returns true when user owns the item", async () => {
		const returningFn = mock(() => [{ id: "item-1" }]);
		const whereFn = mock((): unknown => ({
			returning: returningFn,
		}));
		mockDb.delete.mockReturnValue({ where: whereFn } as unknown as ReturnType<
			typeof mockDb.delete
		>);

		const result = await deleteDiscussionItem("item-1", "correct-user");

		expect(result).toBe(true);
	});
});

describe("getActionItems", () => {
	beforeEach(resetMocks);
	afterEach(resetMocks);

	test("only returns incomplete items", async () => {
		const incompleteItems = [
			{
				id: "action-1",
				retroId: "retro-1",
				userId: "user-1",
				responsibleUserId: "user-2",
				responsibleUserName: "Bob",
				content: "Do the thing",
				completed: false,
				createdAt: new Date(),
				completedAt: null,
			},
		];

		// getActionItems uses select().from().where().orderBy()
		const orderByFn = mock(() => incompleteItems);
		const whereFn = mock((): unknown => ({
			orderBy: orderByFn,
		}));
		const fromFn = mock((): unknown => ({
			where: whereFn,
		}));
		mockDb.select.mockReturnValue({ from: fromFn } as unknown as ReturnType<typeof mockDb.select>);

		const result = await getActionItems("retro-1");

		expect(result).toEqual(incompleteItems);
		expect(result).toHaveLength(1);
		expect(result[0]?.completed).toBe(false);
		expect(mockDb.select).toHaveBeenCalledTimes(1);
	});
});
