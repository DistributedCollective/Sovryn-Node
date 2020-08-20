/**
 * 
 * 
 */

class RouteController {

    /*
    * api methods
    */
    async getCurrentBlock() {
        const b = await this.rsk3.getBlockNumber();
        //console.log("block is " + b);
        return b;
    }

}

const rCtrl = new RouteController();
export default rCtrl;