import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./password-policy";

describe("validateNewPassword", () => {
  it("rejects short passwords", () => expect(validateNewPassword("short", "short")).toMatch(/at least 8/));
  it("rejects mismatches", () => expect(validateNewPassword("longenough1", "longenough2")).toMatch(/do not match/));
  it("accepts valid matching passwords", () => expect(validateNewPassword("longenough1", "longenough1")).toBeNull());
});
