# Migration plan

No consumer migration is included here. Use separate focused PRs after preview publication:

1. Publish notification-contract preview.
2. Migrate Notify.
3. Migrate Build notification adapter.
4. Migrate Deploy notification adapter.
5. Run all consumer and contract tests.
6. Publish ccv2-client preview.
7. Migrate Build transport/auth adapter.
8. Migrate Deploy transport/auth adapter.
9. Run their Sandbox suites.
10. Run build → deploy → notify with producer events accepted by Notify.
11. Implement future Check using notification-contract.
12. Promote packages to stable only after API review and coordinated approval.
13. Release Actions only after coordinated gates.

Preserve the baseline policy throughout. The future Check harness demonstrates compatibility without creating a Check Action or coupling to CLI diagnostics. Shared reusable workflows are future consumers, not part of this foundation.
