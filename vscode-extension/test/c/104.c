#include <stdio.h>
#include <stdlib.h>



static int maxDepth(struct TreeNode* root)
{
    if (root == NULL) {
        return 0;
    }
    int l = maxDepth(root->left) + 1;
    int r = maxDepth(root->right) + 1;
    return l > r ? l : r;
}
