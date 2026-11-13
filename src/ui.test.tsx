import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "./ui";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("keeps forward and backward keyboard focus within a modal", () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    {} as DOMRect,
  ] as unknown as DOMRectList);
  render(
    <Modal title="Review" close={() => {}}>
      <button>Keep chatting</button>
      <button>Start new chat</button>
    </Modal>,
  );
  const first = screen.getByRole("button", { name: "Close dialog" });
  const last = screen.getByRole("button", { name: "Start new chat" });
  first.focus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: "Tab" });
  expect(document.activeElement).toBe(first);
});
