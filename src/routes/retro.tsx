import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useSSE } from "@/lib/use-sse";
import type { ActionItem, DiscussionItem, Retrospective } from "@/types";

interface RetroData {
	retro: Retrospective;
	discussionItems: DiscussionItem[];
	actionItems: ActionItem[];
	user: {
		userId: string;
		userName: string;
	};
}

const CATEGORY_CONFIG = {
	good: {
		title: "What Went Well",
		emoji: "\u{1F60A}",
		color: "bg-green-50 border-green-200",
		headerColor: "bg-green-100 text-green-800",
	},
	bad: {
		title: "What Could Be Improved",
		emoji: "\u{1F615}",
		color: "bg-red-50 border-red-200",
		headerColor: "bg-red-100 text-red-800",
	},
	question: {
		title: "Questions / Discussion Topics",
		emoji: "\u2753",
		color: "bg-blue-50 border-blue-200",
		headerColor: "bg-blue-100 text-blue-800",
	},
} as const;

export const Route = createFileRoute("/retro")({
	component: RetroPage,
});

function RetroPage() {
	const navigate = useNavigate();
	const [data, setData] = useState<RetroData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		try {
			const response = await fetch("/api/retro");
			if (!response.ok) {
				if (response.status === 401) {
					navigate({ to: "/" });
					return;
				}
				throw new Error("Failed to fetch retro data");
			}
			const json = (await response.json()) as RetroData;
			setData(json);
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	}, [navigate]);

	const { connected } = useSSE(
		useCallback(() => {
			fetchData();
		}, [fetchData]),
	);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="text-xl font-semibold text-gray-700">Loading retro...</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="text-xl font-semibold text-red-600">Error: {error}</div>
				</div>
			</div>
		);
	}

	if (!data) {
		return null;
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b border-gray-200">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-bold text-gray-900">Team Retrospective</h1>
							<p className="text-sm text-gray-600 mt-1">Welcome, {data.user.userName}</p>
						</div>
						<div className="flex items-center gap-2 text-sm text-gray-500">
							<span
								className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-400"}`}
								title={connected ? "Live updates connected" : "Live updates disconnected"}
							/>
							<span>{connected ? "Live" : "Offline"}</span>
						</div>
					</div>
				</div>
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
					{(["good", "bad", "question"] as const).map((category) => (
						<DiscussionColumn
							key={category}
							category={category}
							items={data.discussionItems.filter((item) => item.category === category)}
							currentUserId={data.user.userId}
							onRefresh={fetchData}
						/>
					))}
				</div>

				<ActionItemsSection
					actionItems={data.actionItems}
					currentUserId={data.user.userId}
					currentUserName={data.user.userName}
					onRefresh={fetchData}
				/>
			</main>
		</div>
	);
}

function DiscussionColumn({
	category,
	items,
	currentUserId,
	onRefresh,
}: {
	category: "good" | "bad" | "question";
	items: DiscussionItem[];
	currentUserId: string;
	onRefresh: () => void;
}) {
	const [isAdding, setIsAdding] = useState(false);
	const [newContent, setNewContent] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editContent, setEditContent] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const config = CATEGORY_CONFIG[category];

	const handleAdd = async () => {
		if (!newContent.trim() || submitting) return;

		setSubmitting(true);
		try {
			const response = await fetch("/api/discussion-items", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ category, content: newContent }),
			});

			if (response.ok) {
				setNewContent("");
				setIsAdding(false);
				onRefresh();
			}
		} catch (err) {
			console.error("Error adding item:", err);
		} finally {
			setSubmitting(false);
		}
	};

	const handleEdit = async (itemId: string) => {
		if (!editContent.trim() || submitting) return;

		setSubmitting(true);
		try {
			const response = await fetch("/api/discussion-items", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ itemId, content: editContent }),
			});

			if (response.ok) {
				setEditingId(null);
				setEditContent("");
				onRefresh();
			}
		} catch (err) {
			console.error("Error editing item:", err);
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (itemId: string) => {
		if (!confirm("Are you sure you want to delete this item?")) return;

		try {
			const response = await fetch(`/api/discussion-items?itemId=${itemId}`, {
				method: "DELETE",
			});

			if (response.ok) {
				onRefresh();
			}
		} catch (err) {
			console.error("Error deleting item:", err);
		}
	};

	return (
		<div className={`${config.color} border rounded-lg shadow-sm overflow-hidden`}>
			<div className={`${config.headerColor} px-4 py-3 font-semibold`}>
				<span className="mr-2">{config.emoji}</span>
				{config.title}
			</div>

			<div className="p-4 space-y-3">
				{!isAdding ? (
					<button
						type="button"
						onClick={() => setIsAdding(true)}
						className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-white rounded border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
					>
						+ Add item...
					</button>
				) : (
					<div className="bg-white rounded border border-gray-300 p-3 shadow-sm">
						<textarea
							value={newContent}
							onChange={(e) => setNewContent(e.target.value)}
							placeholder="What would you like to share?"
							className="w-full px-2 py-1 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
							rows={3}
						/>
						<div className="flex gap-2 mt-2">
							<button
								type="button"
								onClick={handleAdd}
								disabled={submitting || !newContent.trim()}
								className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Add
							</button>
							<button
								type="button"
								onClick={() => {
									setIsAdding(false);
									setNewContent("");
								}}
								className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
							>
								Cancel
							</button>
						</div>
					</div>
				)}

				{items.map((item) => (
					<div key={item.id} className="bg-white rounded border border-gray-200 p-3 shadow-sm">
						{editingId === item.id ? (
							<div>
								<textarea
									value={editContent}
									onChange={(e) => setEditContent(e.target.value)}
									className="w-full px-2 py-1 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
									rows={3}
								/>
								<div className="flex gap-2 mt-2">
									<button
										type="button"
										onClick={() => handleEdit(item.id)}
										disabled={submitting || !editContent.trim()}
										className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Save
									</button>
									<button
										type="button"
										onClick={() => {
											setEditingId(null);
											setEditContent("");
										}}
										className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<div>
								<div className="text-xs text-gray-500 mb-1 font-medium">{item.userName}</div>
								<div className="text-sm text-gray-800 whitespace-pre-wrap">{item.content}</div>
								{item.userId === currentUserId && (
									<div className="flex gap-2 mt-2">
										<button
											type="button"
											onClick={() => {
												setEditingId(item.id);
												setEditContent(item.content);
											}}
											className="text-xs text-blue-600 hover:text-blue-800"
										>
											Edit
										</button>
										<button
											type="button"
											onClick={() => handleDelete(item.id)}
											className="text-xs text-red-600 hover:text-red-800"
										>
											Delete
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				))}

				{items.length === 0 && !isAdding && (
					<div className="text-center text-sm text-gray-500 italic py-4">No items yet</div>
				)}
			</div>
		</div>
	);
}

function ActionItemsSection({
	actionItems,
	currentUserId,
	currentUserName,
	onRefresh,
}: {
	actionItems: ActionItem[];
	currentUserId: string;
	currentUserName: string;
	onRefresh: () => void;
}) {
	const [isAdding, setIsAdding] = useState(false);
	const [newContent, setNewContent] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleAdd = async () => {
		if (!newContent.trim() || submitting) return;

		setSubmitting(true);
		try {
			const response = await fetch("/api/action-items", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: newContent,
					responsibleUserId: currentUserId,
					responsibleUserName: currentUserName,
				}),
			});

			if (response.ok) {
				setNewContent("");
				setIsAdding(false);
				onRefresh();
			}
		} catch (err) {
			console.error("Error adding action item:", err);
		} finally {
			setSubmitting(false);
		}
	};

	const handleToggle = async (itemId: string, completed: boolean) => {
		try {
			const response = await fetch("/api/action-items", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ itemId, completed: !completed }),
			});

			if (response.ok) {
				onRefresh();
			}
		} catch (err) {
			console.error("Error toggling action item:", err);
		}
	};

	return (
		<div className="bg-white border border-gray-200 rounded-lg shadow-sm">
			<div className="bg-purple-100 text-purple-800 px-4 py-3 font-semibold">
				<span className="mr-2">{"\u{1F3AF}"}</span>
				Action Items
			</div>

			<div className="p-4 space-y-3">
				{!isAdding ? (
					<button
						type="button"
						onClick={() => setIsAdding(true)}
						className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
					>
						+ Add action item...
					</button>
				) : (
					<div className="bg-gray-50 rounded border border-gray-300 p-3">
						<textarea
							value={newContent}
							onChange={(e) => setNewContent(e.target.value)}
							placeholder="What needs to be done?"
							className="w-full px-2 py-1 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
							rows={3}
						/>
						<div className="flex gap-2 mt-2">
							<button
								type="button"
								onClick={handleAdd}
								disabled={submitting || !newContent.trim()}
								className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Add
							</button>
							<button
								type="button"
								onClick={() => {
									setIsAdding(false);
									setNewContent("");
								}}
								className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
							>
								Cancel
							</button>
						</div>
					</div>
				)}

				<div className="space-y-2">
					{actionItems.map((item) => (
						<div
							key={item.id}
							className="flex items-start gap-3 p-3 bg-gray-50 rounded border border-gray-200"
						>
							<input
								type="checkbox"
								checked={item.completed ?? false}
								onChange={() => handleToggle(item.id, item.completed ?? false)}
								className="mt-0.5 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
								aria-label={`Mark "${item.content}" as ${item.completed ? "incomplete" : "complete"}`}
							/>
							<div className="flex-1">
								<div className="text-xs text-gray-500 mb-1 font-medium">
									{item.responsibleUserName}
								</div>
								<div
									className={`text-sm ${
										item.completed ? "text-gray-500 line-through" : "text-gray-800"
									} whitespace-pre-wrap`}
								>
									{item.content}
								</div>
							</div>
						</div>
					))}
				</div>

				{actionItems.length === 0 && !isAdding && (
					<div className="text-center text-sm text-gray-500 italic py-4">No action items yet</div>
				)}
			</div>
		</div>
	);
}
