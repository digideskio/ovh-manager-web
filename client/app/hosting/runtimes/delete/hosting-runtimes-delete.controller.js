angular.module('App').controller(
  'controllers.Hosting.Runtimes.delete',
  class HostingRuntimesDeleteCtrl {
    constructor($scope, $stateParams, $translate, Alerter, HostingRuntimes) {
      this.$scope = $scope;
      this.$stateParams = $stateParams;
      this.$translate = $translate;

      this.Alerter = Alerter;
      this.HostingRuntimes = HostingRuntimes;
    }

    $onInit() {
      const actionData = angular.copy(this.$scope.currentActionData);
      this.entryToDelete = actionData.runtime;

      this.$scope.delete = () => this.delete();
    }

    delete() {
      this.HostingRuntimes.delete(
        this.$stateParams.productId,
        this.entryToDelete.id,
      )
        .then(() => {
          this.Alerter.success(
            this.$translate.instant('hosting_tab_RUNTIMES_delete_success'),
            this.$scope.alerts.main,
          );
        })
        .catch((err) => {
          this.Alerter.error(
            this.$translate.instant('hosting_tab_RUNTIMES_delete_error')
              + err.message,
            this.$scope.alerts.main,
          );
        })
        .finally(() => {
          this.$scope.resetAction();
        });
    }
  },
);
