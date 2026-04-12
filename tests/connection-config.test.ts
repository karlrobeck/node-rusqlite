import { expect } from "@std/expect";

// @ts-types="../bindings/binding.d.ts"
import { Connection, DbConfig } from "../bindings/binding.js";

let conn: Connection;

Deno.test.beforeEach(() => {
  conn = Connection.openInMemory();
});

Deno.test("connection.dbConfig()", async (t) => {
  await t.step("should read database config flag", () => {
    expect(() => {
      conn.dbConfig(DbConfig.SqliteDbconfigEnableFkey);
    }).not.toThrow();
  });

  await t.step("should handle various DbConfig options", () => {
    const configs = [
      DbConfig.SqliteDbconfigEnableFkey,
      DbConfig.SqliteDbconfigEnableTrigger,
      DbConfig.SqliteDbconfigDefensive,
    ];

    for (const config of configs) {
      expect(() => {
        conn.dbConfig(config);
      }).not.toThrow();
    }
  });
});

Deno.test("connection.setDbConfig()", async (t) => {
  await t.step("should set config flag to true", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true);
    }).not.toThrow();
  });

  await t.step("should set config flag to false", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, false);
    }).not.toThrow();
  });

  await t.step("should handle enabling foreign keys", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true);
    }).not.toThrow();
  });

  await t.step("should handle disabling foreign keys", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, false);
    }).not.toThrow();
  });

  await t.step("should handle enabling triggers", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableTrigger, true);
    }).not.toThrow();
  });

  await t.step("should handle enabling defensive mode", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigDefensive, true);
    }).not.toThrow();
  });

  await t.step("should handle enabling FTS3 tokenizer", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableFts3Tokenizer, true);
    }).not.toThrow();
  });

  await t.step("should handle enabling QPSG", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableQpsg, true);
    }).not.toThrow();
  });

  await t.step("should handle multiple config changes", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true);
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableTrigger, true);
      conn.setDbConfig(DbConfig.SqliteDbconfigDefensive, true);
    }).not.toThrow();
  });

  await t.step("should handle config changes with boolean toggling", () => {
    expect(() => {
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true);
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, false);
      conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true);
    }).not.toThrow();
  });
});

Deno.test("DbConfig Enum", async (t) => {
  await t.step("should have standard config options", () => {
    expect(DbConfig.SqliteDbconfigEnableFkey).toBeDefined();
    expect(DbConfig.SqliteDbconfigEnableTrigger).toBeDefined();
    expect(DbConfig.SqliteDbconfigDefensive).toBeDefined();
  });

  await t.step("should have numeric values", () => {
    expect(typeof DbConfig.SqliteDbconfigEnableFkey).toBe("number");
    expect(typeof DbConfig.SqliteDbconfigEnableTrigger).toBe("number");
  });

  await t.step("should have distinct values", () => {
    expect(DbConfig.SqliteDbconfigEnableFkey).not.toBe(
      DbConfig.SqliteDbconfigEnableTrigger,
    );
  });

  await t.step("should support all documented options", () => {
    const options = [
      DbConfig.SqliteDbconfigEnableFkey,
      DbConfig.SqliteDbconfigEnableTrigger,
      DbConfig.SqliteDbconfigEnableFts3Tokenizer,
      DbConfig.SqliteDbconfigNoCkptOnClose,
      DbConfig.SqliteDbconfigEnableQpsg,
      DbConfig.SqliteDbconfigTriggerEqp,
      DbConfig.SqliteDbconfigResetDatabase,
      DbConfig.SqliteDbconfigDefensive,
      DbConfig.SqliteDbconfigWritableSchema,
      DbConfig.SqliteDbconfigLegacyAlterTable,
      DbConfig.SqliteDbconfigDqsDml,
      DbConfig.SqliteDbconfigDqsDdl,
      DbConfig.SqliteDbconfigEnableView,
      DbConfig.SqliteDbconfigLegacyFileFormat,
      DbConfig.SqliteDbconfigTrustedSchema,
      DbConfig.SqliteDbconfigStmtScanStatus,
      DbConfig.SqliteDbconfigReverseScanOrder,
      DbConfig.SqliteDbconfigEnableAttachCreate,
      DbConfig.SqliteDbconfigEnableAttachWrite,
      DbConfig.SqliteDbconfigEnableComments,
    ];

    for (const option of options) {
      expect(typeof option).toBe("number");
    }
  });
});
